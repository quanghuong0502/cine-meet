// SeatMate service worker. It does three small things and nothing else:
//  1. shows push notifications and opens the right page when one is tapped;
//  2. shows the /offline page when a page cannot be loaded because there is no network;
//  3. keeps that offline page and the app icon so (2) works.
// It never stores pages or API answers: what the app shows is personal (plans, spending), so the network always decides.
// Change VERSION to ship a new worker: old caches are deleted on activate, and the new worker takes over at once.
const VERSION = "v1";
const CACHE = `seatmate-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const ICON = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, ICON]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("seatmate-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network first, always. Only a failed page load (no network) falls back to the offline page.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error())));
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
