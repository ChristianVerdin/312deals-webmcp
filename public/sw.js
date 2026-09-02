// 312Deals Service Worker, Cache-first for static assets, network-first for API/pages
// Bumped 2026-05-19, May 14 Maps API key rotation + May 19 Railway outage
// may have left stale cached fetch responses on returning users. Bumping
// CACHE_NAME forces the activate handler to delete all v1 caches and
// rebuild from the current network state.
const CACHE_NAME = "312deals-v2";

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: pre-cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // API calls: network-first with no cache fallback
  if (url.pathname.startsWith("/api/")) return;

  // Next.js data/build files: network-first, cache fallback
  if (url.pathname.startsWith("/_next/data/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets (_next/static, images, fonts): cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML pages: network-first with offline fallback
  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback for navigation requests
    if (request.mode === "navigate") {
      const cachedHome = await caches.match("/");
      if (cachedHome) return cachedHome;
    }
    return new Response("Offline", { status: 503 });
  }
}
