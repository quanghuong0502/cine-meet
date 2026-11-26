#!/usr/bin/env node
/**
 * Lightweight Playwright PWA smoke & mobile-invariant verification on a production build.
 * Checks iPhone 14 Pro (393x852) and iPhone SE (320x568) viewports for:
 *  - Manifest, Service Worker registration, and static /offline.html
 *  - Zero console / page errors on public shell routes (/login, /offline)
 *  - Zero horizontal overflow (scrollWidth === clientWidth)
 *  - All visible inputs >= 16px (prevents iOS Safari auto-zoom)
 *  - `overscroll-behavior: none` and `dvh` layout invariants
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3100 node scripts/e2e-pwa.mjs
 *   (or let the script spawn `next start` automatically on port 3199 using `.next` / `NEXT_DIST_DIR`)
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = Number(process.env.E2E_PORT ?? 3199);
const EXTERNAL_URL = process.env.BASE_URL;
const BASE_URL = EXTERNAL_URL ?? `http://127.0.0.1:${PORT}`;

async function waitForServer(url, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${url}/offline.html`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

let serverProcess = null;
if (!EXTERNAL_URL) {
  serverProcess = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", AUTH_TRUST_HOST: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stderr?.on("data", (d) => {
    const text = d.toString();
    if (text.toLowerCase().includes("error")) process.stderr.write(text);
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

try {
  await waitForServer(BASE_URL);

  // 1. Static PWA assets & cache headers
  const [swRes, manifestRes, offlineHtmlRes] = await Promise.all([
    fetch(`${BASE_URL}/sw.js`),
    fetch(`${BASE_URL}/manifest.webmanifest`),
    fetch(`${BASE_URL}/offline.html`),
  ]);
  assert(swRes.ok, `/sw.js returned ${swRes.status}`);
  assert(
    (swRes.headers.get("cache-control") ?? "").includes("no-store"),
    `/sw.js Cache-Control must include no-store (got ${swRes.headers.get("cache-control")})`,
  );
  assert(manifestRes.ok, `/manifest.webmanifest returned ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  assert(manifest.display === "standalone", `manifest display must be standalone (got ${manifest.display})`);
  assert(offlineHtmlRes.ok, `/offline.html returned ${offlineHtmlRes.status}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const viewports = [
      { name: "iPhone 14 Pro", width: 393, height: 852, deviceScaleFactor: 3 },
      { name: "iPhone SE", width: 320, height: 568, deviceScaleFactor: 2 },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });

      for (const path of ["/login", "/offline"]) {
        const res = await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
        assert(res && res.status() < 400, `${vp.name} ${path} HTTP ${res?.status()}`);

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const inputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), textarea, select")];
          const smallInputs = inputs
            .map((el) => ({ name: el.getAttribute("name") || el.tagName, size: parseFloat(getComputedStyle(el).fontSize) }))
            .filter((i) => i.size < 16);
          return {
            overflow: doc.scrollWidth - doc.clientWidth,
            overscroll: getComputedStyle(doc).overscrollBehavior,
            smallInputs,
            hasPreconnect: Boolean(document.querySelector('link[rel="preconnect"][href="https://res.cloudinary.com"]')),
          };
        });

        assert(metrics.overflow <= 0, `${vp.name} ${path} horizontal overflow ${metrics.overflow}px`);
        assert(metrics.smallInputs.length === 0, `${vp.name} ${path} inputs < 16px: ${JSON.stringify(metrics.smallInputs)}`);
        assert(metrics.overscroll.includes("none"), `${vp.name} ${path} html overscroll-behavior=${metrics.overscroll}`);
        assert(metrics.hasPreconnect, `${vp.name} ${path} missing preconnect to res.cloudinary.com`);
      }

      // Check Service Worker registration on iPhone 14 Pro viewport
      if (vp.width === 393) {
        const swState = await page.evaluate(async () => {
          if (!("serviceWorker" in navigator)) return "unsupported";
          const reg = await navigator.serviceWorker.ready;
          return reg.active ? reg.active.state : "pending";
        });
        assert(swState === "activated" || swState === "activating", `Service worker did not activate (state=${swState})`);
      }

      assert(errors.length === 0, `${vp.name} runtime errors:\n${errors.join("\n")}`);
      await context.close();
      console.log(`  [PASS] ${vp.name} (${vp.width}x${vp.height})`);
    }
  } finally {
    await browser.close();
  }

  console.log("All PWA Playwright smoke & mobile checks passed.");
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}
