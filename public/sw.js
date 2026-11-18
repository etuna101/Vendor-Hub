/*
 * This file intentionally lives in public/ so it is copied into the deployed
 * public directory. The TanStack/Nitro build places client assets in
 * .output/public, while vite-plugin-pwa writes its generated worker outside
 * that directory; Vercel therefore returned 404 for /sw.js.
 */
const CACHE_NAME = "vendorhub-runtime-v2";
const APP_SHELL = ["/", "/app/dashboard", "/manifest.webmanifest"];

const isCacheable = (response) => response.ok && response.type === "basic";
const isStaticAsset = (url) => /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);

function cacheResponse(request, response) {
  if (!isCacheable(response)) return;

  // Clone before returning the response, and absorb cache failures so they
  // cannot turn a successful page or asset request into a fetch error.
  const copy = response.clone();
  void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => new Response("Network unavailable", { status: 503, statusText: "Service Unavailable" })),
    );
    return;
  }

  const url = new URL(request.url);
  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          cacheResponse(request, response);
          return response;
        }),
    ),
  );
});
