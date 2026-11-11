/* Service worker v4: refresh HTML/CSS/JS from network so UI deployments are not hidden by stale PWA cache. */
const CACHE_NAME = "catat-hutang-shell-v4";
const APP_SHELL = [
  "/", "/index.html",
  "/style.css?v=20261111-ui2",
  "/app.js?v=20261111-ui2",
  "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isDocument = req.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html";
  const isUiAsset = /\.(css|js)$/.test(url.pathname);

  // Always prefer the latest deployed document and UI assets; use cache only when offline.
  if (isDocument || isUiAsset) {
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => caches.match(req).then(cached => cached || caches.match("/index.html")))
    );
    return;
  }

  // Other static resources may use cache-first behavior.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return response;
    }))
  );
});
