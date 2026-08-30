// ============================================================
// LIBRETA — Service Worker (lo que la hace instalable + offline)
// Estrategia: app-shell precacheado (HTML/JS/CSS de Next) +
// cache-first para assets estáticos. Los DATOS viven en IndexedDB,
// así que el SW solo necesita servir la shell para que todo funcione.
// ============================================================
// Cada deploy nuevo → cache nueva → el celu baja TODO fresco
const CACHE = "libreta-shell-v3";
// GitHub Pages sirve bajo /libreta-pos/ — rutas relativas para no romper
const BASE = "/libreta-pos";
const PRECACHE = [`${BASE}/`, `${BASE}/manifest.json`, `${BASE}/icon-192.png`, `${BASE}/icon-512.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first para navegación (que baje HTML fresco si hay red),
// y si no hay red → cache (el almacén sigue vendiendo igual).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((m) => m ?? caches.match(`${BASE}/`)))
    );
    return;
  }

  // estáticos: cache-first
  if (request.destination === "image" || request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (m) =>
          m ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
  }
});