// SeatMate service worker:
//  1. Shows push notifications and opens the right page when one is tapped;
//  2. Uses Navigation Preload so cold SW startup does not delay page navigation;
//  3. Serves a self-contained static /offline.html when there is no network;
//  4. Caches immutable /_next/static/* assets (cache-first) and public icons/splash/Cloudinary images (stale-while-revalidate)
//     with strict per-cache caps — NEVER caches HTML pages, RSC Flight payloads, or authenticated API responses;
//  5. Controlled updates: waits in `waiting` state until the user confirms via `{ type: "SKIP_WAITING" }` so lazy chunks never 404 mid-session.
const VERSION = "v4";
const STATIC_CACHE = `seatmate-static-${VERSION}`;
const ASSET_CACHE = `seatmate-assets-${VERSION}`;
const IMAGE_CACHE = `seatmate-images-${VERSION}`;
const ACTIVE_CACHES = new Set([STATIC_CACHE, ASSET_CACHE, IMAGE_CACHE]);
const OFFLINE_URL = "/offline.html";
const ICON = "/icons/icon-192.png";
const MAX_STATIC_ENTRIES = 30;
const MAX_STATIC_ASSETS = 150;
const MAX_IMAGES = 80;
const IS_LOCAL_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL, ICON])),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("seatmate-") && !ACTIVE_CACHES.has(key))
              .map((key) => caches.delete(key)),
          ),
        ),
      self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(() => undefined) : Promise.resolve(),
    ]).then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

function staleWhileRevalidate(request, cacheName, maxEntries, allowOpaque = false) {
  return caches.open(cacheName).then(async (cache) => {
    const hit = await cache.match(request);
    const update = fetch(request)
      .then((response) => {
        if (response.ok || (allowOpaque && response.type === "opaque")) {
          cache
            .put(request, response.clone())
            .then(() => trimCache(cacheName, maxEntries))
            .catch(() => undefined);
        }
        return response;
      })
      .catch(() => hit || Response.error());
    return hit || update;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // 1. Page navigations: network-only (via navigationPreload when available), falling back to static /offline.html.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Never intercept or cache RSC Flight payloads or authenticated API endpoints.
  const accept = request.headers.get("accept") || "";
  if (request.headers.get("rsc") === "1" || accept.includes("text/x-component")) return;

  const url = new URL(request.url);

  // 2. Public Cloudinary images (movie posters, branch photos, brand logos): stale-while-revalidate with strict cap.
  if (
    url.origin === "https://res.cloudinary.com" &&
    url.pathname.includes("/image/upload/") &&
    request.destination === "image"
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGES, true));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // 3. Content-hashed Next.js static bundles (JS/CSS/fonts): cache-first ONLY for immutable production assets
  //    (never cache mutable dev chunks on localhost or non-immutable responses from `next dev`).
  if (!IS_LOCAL_DEV && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        const cc = response.headers.get("cache-control") || "";
        if (response.ok && cc.includes("immutable")) {
          cache.put(request, response.clone()).then(() => trimCache(ASSET_CACHE, MAX_STATIC_ASSETS)).catch(() => undefined);
        }
        return response;
      }),
    );
    return;
  }

  // 4. Local Next.js optimized images (mascots): stale-while-revalidate.
  if (!IS_LOCAL_DEV && url.pathname === "/_next/image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGES, false));
    return;
  }

  // 5. App icons & splash assets: stale-while-revalidate with cap.
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/")) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE, MAX_STATIC_ENTRIES, false));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "SeatMate";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: ICON,
      badge: ICON,
      data: { url },
      // A newer push about the same page replaces the older one instead of piling up.
      tag: url,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0];
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    }),
  );
});
