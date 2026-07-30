// BUMP THIS ON EVERY DEPLOY (or use a build-time injection) — otherwise the
// activate handler won't delete the old cache and users get stale JS/HTML.
const CACHE_NAME = "hassaniya-v49-20260607-eval-exclude";
const STATIC_ASSETS = [
  "/",
  "/contribute",
  "/faq",
  "/validate",
  "/leaderboard",
  "/dashboard",
  "/manifest.json",
];

// Install: cache static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever handle SAME-ORIGIN, non-API GET requests. Everything else goes
  // straight to the network untouched:
  //  - cross-origin (Google Fonts, etc.): re-fetching them from the SW turns a
  //    style/font load into a connect-src fetch and trips CSP → fonts break.
  //  - /api/* and /recordings/*: must always hit the network (never cached).
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/recordings/")
  ) {
    return;
  }

  // For navigation requests: network first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // For static assets: cache first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok && (url.pathname.match(/\.(js|css|png|svg|woff2?)$/) || url.hostname.includes("fonts"))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
