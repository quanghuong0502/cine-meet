#!/usr/bin/env node
/**
 * Measures First Load JS (raw & gzip) across all Next.js 16 App Router routes
 * from `.next/` (or `NEXT_DIST_DIR`), checks security/isolation invariants
 * (no `three` on initial routes, no `zod`/`mongoose` in client chunks), and
 * enforces performance budgets.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs           # enforce budgets
 *   node scripts/check-bundle-budget.mjs --report  # print full report without failing
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const REPORT_ONLY = process.argv.includes("--report");
const DIST_DIR = join(process.cwd(), process.env.NEXT_DIST_DIR ?? ".next");

// Performance budgets (gzip KB). Enforced on production build to prevent future regressions.
const BUDGETS = {
  // Primary user tab & entry routes (includes Next.js + React + polyfills ~167 KB gz)
  maxCoreRouteGzipKb: 255,
  // Heavy interactive/form/editor routes (2D seat map, auditorium editor, rich forms)
  maxHeavyRouteGzipKb: 330,
  // Largest single non-three chunk loaded on initial routes
  maxInitialChunkGzipKb: 75,
  // Combined lazy-loaded Three.js 3D chunks ceiling
  maxThreeTotalGzipKb: 165,
};

const CORE_ROUTES = new Set([
  "/(auth)/login/page",
  "/(user)/page",
  "/(user)/showtimes/page",
  "/(user)/cinemas/page",
  "/(user)/appointments/page",
  "/admin/page",
]);

const KEY_ROUTES = [
  "/(auth)/login/page",
  "/(user)/page",
  "/(user)/showtimes/page",
  "/(user)/movies/[id]/page",
  "/(user)/cinemas/page",
  "/(user)/cinemas/[branchId]/[auditoriumId]/page",
  "/(user)/appointments/page",
  "/(user)/appointments/[id]/page",
  "/(user)/settings/page",
  "/admin/page",
  "/admin/auditoriums/[id]/page",
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sizeCache = new Map();
function chunkSizes(relPath) {
  const normalized = relPath.replace(/^\/?_next\//, "");
  if (sizeCache.has(normalized)) return sizeCache.get(normalized);
  const abs = join(DIST_DIR, normalized);
  if (!existsSync(abs)) {
    const empty = { raw: 0, gz: 0, text: "" };
    sizeCache.set(normalized, empty);
    return empty;
  }
  const buf = readFileSync(abs);
  const info = {
    raw: buf.length,
    gz: gzipSync(buf, { level: 9 }).length,
    text: normalized.endsWith(".js") ? buf.toString("utf8") : "",
  };
  sizeCache.set(normalized, info);
  return info;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

if (!existsSync(join(DIST_DIR, "build-manifest.json"))) {
  console.error(`Missing ${join(DIST_DIR, "build-manifest.json")}. Run \`npm run build\` first.`);
  process.exit(1);
}

const buildManifest = JSON.parse(readFileSync(join(DIST_DIR, "build-manifest.json"), "utf8"));
const baseJs = [...(buildManifest.polyfillFiles ?? []), ...(buildManifest.rootMainFiles ?? [])].filter((f) =>
  f.endsWith(".js"),
);

// Load every page's client reference manifest.
const manifestFiles = walk(join(DIST_DIR, "server", "app")).filter((f) =>
  f.endsWith("page_client-reference-manifest.js"),
);

const routes = new Map();
for (const file of manifestFiles) {
  const sandbox = { globalThis: {} };
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  const rscMap = sandbox.globalThis.__RSC_MANIFEST ?? {};
  for (const [route, data] of Object.entries(rscMap)) {
    const chunks = new Set(baseJs);
    for (const mod of Object.values(data.clientModules ?? {})) {
      if (mod?.async) continue;
      for (const chunk of mod?.chunks ?? []) {
        if (typeof chunk === "string" && chunk.endsWith(".js")) {
          chunks.add(chunk.replace(/^\/?_next\//, ""));
        }
      }
    }
    let raw = 0;
    let gz = 0;
    for (const c of chunks) {
      const s = chunkSizes(c);
      raw += s.raw;
      gz += s.gz;
    }
    routes.set(route, { chunks: [...chunks], raw, gz });
  }
}

// Scan all built client JS chunks.
const allChunkFiles = walk(join(DIST_DIR, "static", "chunks")).filter((f) => f.endsWith(".js"));
const chunkStats = allChunkFiles
  .map((abs) => {
    const rel = relative(DIST_DIR, abs);
    const s = chunkSizes(rel);
    const hasThree = s.text.includes("WebGLRenderer") && s.text.includes("PerspectiveCamera");
    const hasZod = s.text.includes("ZodObject") || s.text.includes("ZodError");
    const hasMongoose = s.text.includes("MongooseError") || s.text.includes("SchemaType");
    return { rel, raw: s.raw, gz: s.gz, hasThree, hasZod, hasMongoose };
  })
  .sort((a, b) => b.gz - a.gz);

const baseRaw = baseJs.reduce((acc, c) => acc + chunkSizes(c).raw, 0);
const baseGz = baseJs.reduce((acc, c) => acc + chunkSizes(c).gz, 0);

console.log(`\n=== SeatMate Bundle Report (${relative(process.cwd(), DIST_DIR) || ".next"}) ===`);
console.log(`Total routes analyzed : ${routes.size}`);
console.log(`Total client JS files : ${chunkStats.length} (${kb(chunkStats.reduce((a, c) => a + c.raw, 0))} KB raw)`);
console.log(`Base framework + poly : ${kb(baseRaw)} KB raw / ${kb(baseGz)} KB gz\n`);

console.log("Key routes (First Load JS = base + route initial chunks):");
for (const route of KEY_ROUTES) {
  const info = routes.get(route);
  if (!info) continue;
  console.log(`  ${route.padEnd(48)} ${kb(info.raw).padStart(7)} KB raw | ${kb(info.gz).padStart(6)} KB gz`);
}

const heaviestRoutes = [...routes.entries()].sort((a, b) => b[1].gz - a[1].gz).slice(0, 5);
console.log("\nTop 5 heaviest routes (First Load JS):");
for (const [route, info] of heaviestRoutes) {
  console.log(`  ${route.padEnd(48)} ${kb(info.raw).padStart(7)} KB raw | ${kb(info.gz).padStart(6)} KB gz`);
}

console.log("\nTop 8 largest JS chunks:");
for (const c of chunkStats.slice(0, 8)) {
  const tag = c.hasThree ? " [three/3D]" : "";
  console.log(`  ${c.rel.padEnd(42)} ${kb(c.raw).padStart(7)} KB raw | ${kb(c.gz).padStart(6)} KB gz${tag}`);
}

// Check invariants & budgets.
const failures = [];
const threeChunks = chunkStats.filter((c) => c.hasThree);
const threeChunkSet = new Set(threeChunks.map((c) => c.rel));

for (const [route, info] of routes.entries()) {
  for (const c of info.chunks) {
    if (threeChunkSet.has(c)) {
      failures.push(`Three.js chunk (${c}) leaked into initial route ${route}`);
    }
  }
  const gzKb = info.gz / 1024;
  const limit = CORE_ROUTES.has(route) ? BUDGETS.maxCoreRouteGzipKb : BUDGETS.maxHeavyRouteGzipKb;
  if (gzKb > limit) {
    failures.push(`Route ${route} First Load JS ${gzKb.toFixed(1)} KB gz exceeds budget ${limit} KB gz`);
  }
}

let threeTotalGz = 0;
for (const c of chunkStats) {
  if (c.hasZod) failures.push(`Zod runtime leaked into client chunk ${c.rel}`);
  if (c.hasMongoose) failures.push(`Mongoose leaked into client chunk ${c.rel}`);
  const gzKb = c.gz / 1024;
  if (c.hasThree) {
    threeTotalGz += gzKb;
  } else if (gzKb > BUDGETS.maxInitialChunkGzipKb) {
    failures.push(`Client chunk ${c.rel} is ${gzKb.toFixed(1)} KB gz (budget ${BUDGETS.maxInitialChunkGzipKb} KB gz)`);
  }
}
if (threeTotalGz > BUDGETS.maxThreeTotalGzipKb) {
  failures.push(`Combined Three.js chunks are ${threeTotalGz.toFixed(1)} KB gz (budget ${BUDGETS.maxThreeTotalGzipKb} KB gz)`);
}

if (failures.length > 0) {
  console.log(`\nBudget / invariant findings (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  if (!REPORT_ONLY) process.exit(1);
} else {
  console.log("\nAll bundle budgets and isolation invariants passed.");
}
