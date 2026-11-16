"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppOpenedMarker } from "@/components/route-loading";

interface Box {
  tag: string;
  label: string;
  w: number;
  h: number;
  x: number;
  y: number;
}

interface RouteReport {
  route: string;
  viewport: { w: number; h: number };
  loaded: boolean;
  smallTargets: Box[];
  tooClose: { a: string; b: string; gap: number }[];
  overlapping: { a: string; b: string }[];
  smallText: { label: string; px: number }[];
  smallInputs: { label: string; px: number }[];
  horizontalOverflow: number;
  outsideViewport: Box[];
  bottomFixedOverlap: string[];
}

const TARGET_SELECTOR = "a[href],button,[role=button],[role=switch],[role=tab],input:not([type=hidden]),select,textarea";
const MIN_TARGET = 44;
const MIN_GAP = 8;

function describe(el: Element): string {
  const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
  return `${el.tagName.toLowerCase()}${label ? `:${label}` : ""}`;
}

function measure(route: string, win: Window): RouteReport {
  const doc = win.document;
  const vw = win.innerWidth;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), label: describe(el), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) };
  };

  const targets = [...doc.querySelectorAll(TARGET_SELECTOR)].filter(visible);
  const smallTargets = targets.map(box).filter((b) => b.w < MIN_TARGET || b.h < MIN_TARGET);

  const tooClose: RouteReport["tooClose"] = [];
  const overlapping: RouteReport["overlapping"] = [];
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!;
      const b = targets[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dx = Math.max(ra.left - rb.right, rb.left - ra.right);
      const dy = Math.max(ra.top - rb.bottom, rb.top - ra.bottom);
      if (dx < 0 && dy < 0) overlapping.push({ a: describe(a), b: describe(b) });
      else if (Math.max(dx, dy) < MIN_GAP) tooClose.push({ a: describe(a), b: describe(b), gap: Math.round(Math.max(dx, dy)) });
    }
  }

  const smallText: RouteReport["smallText"] = [];
  const smallInputs: RouteReport["smallInputs"] = [];
  for (const el of doc.body.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const px = parseFloat(win.getComputedStyle(el).fontSize);
    if (el.matches("input,select,textarea")) {
      if (px < 16) smallInputs.push({ label: describe(el), px });
    } else if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) && px < 12) {
      smallText.push({ label: describe(el), px });
    }
  }

  const outsideViewport = [...doc.body.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > vw + 1 || r.left < -1;
    })
    .slice(0, 10)
    .map(box);

  const fixed = [...doc.querySelectorAll("[data-bottom-fixed]")].filter(visible);
  const bottomFixedOverlap: string[] = [];
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i]!.getBoundingClientRect();
      const b = fixed[j]!.getBoundingClientRect();
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        bottomFixedOverlap.push(`${describe(fixed[i]!)} overlaps ${describe(fixed[j]!)}`);
      }
    }
  }

  return {
    route,
    viewport: { w: vw, h: win.innerHeight },
    loaded: true,
    smallTargets: smallTargets.slice(0, 30),
    tooClose: tooClose.slice(0, 30),
    overlapping: overlapping.slice(0, 30),
    smallText: smallText.slice(0, 20),
    smallInputs: smallInputs.slice(0, 20),
    horizontalOverflow: doc.documentElement.scrollWidth - vw,
    outsideViewport,
    bottomFixedOverlap,
  };
}

const LOAD_TIMEOUT_MS = 20_000;

export function AuditRunner({ routes }: { routes: string[] }) {
  const [index, setIndex] = useState(0);
  // The phone's own window size, read once on the client ("" while rendering on the server).
  const sizeText = useSyncExternalStore(
    () => () => undefined,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "",
  );
  const size = sizeText ? { w: Number(sizeText.split("x")[0]), h: Number(sizeText.split("x")[1]) } : null;
  const reports = useRef<RouteReport[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!size) return;
    if (index >= routes.length) return;
    const route = routes[index]!;
    let cancelled = false;
    const started = Date.now();

    const send = async (done: boolean) => {
      await fetch("/api/dev/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: new Date().toISOString(), userAgent: navigator.userAgent, done, reports: reports.current }),
      }).catch(() => undefined);
    };

    const poll = setInterval(async () => {
      const win = frame.current?.contentWindow;
      const ready =
        win &&
        win.document.readyState === "complete" &&
        win.location.pathname !== "about:blank" &&
        !win.document.querySelector('[role="status"]') &&
        win.document.body.children.length > 0;
      const timedOut = Date.now() - started > LOAD_TIMEOUT_MS;
      if (cancelled || (!ready && !timedOut)) return;
      clearInterval(poll);
      // A moment for fonts and images to settle after the loader is gone.
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (cancelled) return;
      const report: RouteReport = win && ready
        ? measure(route, win)
        : { route, viewport: size, loaded: false, smallTargets: [], tooClose: [], overlapping: [], smallText: [], smallInputs: [], horizontalOverflow: 0, outsideViewport: [], bottomFixedOverlap: [] };
      reports.current = [...reports.current, report];
      const last = index + 1 >= routes.length;
      await send(last);
      setIndex(index + 1);
    }, 400);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [index, routes, sizeText]); // eslint-disable-line react-hooks/exhaustive-deps

  const status =
    index >= routes.length
      ? "Done. You can close this page."
      : size
        ? `Measuring ${index + 1}/${routes.length}: ${routes[index]}`
        : "Starting...";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <AppOpenedMarker />
      <p className="text-base font-semibold">Dev audit</p>
      <p className="text-sm text-muted-foreground">{status}</p>
      {size && index < routes.length ? (
        // Off screen, but with the phone's own size, so every screen lays out exactly as it would on this phone.
        <iframe
          key={routes[index]}
          ref={frame}
          src={routes[index]}
          title="audit"
          aria-hidden
          tabIndex={-1}
          style={{ position: "fixed", left: -10000, top: 0, width: size.w, height: size.h, border: 0 }}
        />
      ) : null}
    </main>
  );
}
