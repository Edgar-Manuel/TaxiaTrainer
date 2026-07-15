/* TaxiTrainer AI service worker: offline app shell + map tile cache. */

const VERSION = "v1";
const SHELL_CACHE = `tt-shell-${VERSION}`;
const TILE_CACHE = `tt-tiles-${VERSION}`;
const MAX_TILES = 600;

const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "basemaps.cartocdn.com",
  "server.arcgisonline.com",
  "api.maptiler.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", "/dashboard", "/play", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, TILE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Map tiles: cache-first with a bounded cache.
  if (TILE_HOSTS.some((host) => url.hostname.endsWith(host))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
          trimCache(TILE_CACHE, MAX_TILES);
        }
        return response;
      }),
    );
    return;
  }

  // Same-origin pages/assets: network-first, cache fallback (offline).
  if (url.origin === self.location.origin && !url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r ?? caches.match("/"))),
    );
  }
});
