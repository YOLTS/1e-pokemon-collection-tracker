const CACHE_NAME = "pokemon-tracker-shell-v8";
const OFFLINE_URL = "/offline?v=8";
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest?v=8",
  "/icons/icon-192.png?v=8",
  "/icons/icon-512.png?v=8",
  "/icons/icon-maskable-512.png?v=8",
  "/icons/apple-touch-icon.png?v=8",
  "/icons/favicon-32.png?v=8",
  "/logos/top_banner_logo.png",
  "/backgrounds/neon_bg1.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((response) => response || Response.error())),
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/logos/") ||
      url.pathname.startsWith("/backgrounds/") ||
      url.pathname === "/manifest.webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        });
      }),
    );
  }
});
