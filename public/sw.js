/*
 * This file intentionally lives in public/ so it is copied into the deployed
 * public directory. The TanStack/Nitro build places client assets in
 * .output/public, while vite-plugin-pwa writes its generated worker outside
 * that directory; Vercel therefore returned 404 for /sw.js.
 */
const CACHE_NAME = "vendorhub-runtime-v1";
const APP_SHELL = ["/", "/app/dashboard", "/manifest.webmanifest"];

const isCacheable = (response) => response.ok && response.type === "basic";

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
        .then((response) => {
          if (isCacheable(response)) {
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/app/dashboard")) ?? (await caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (isCacheable(response)) {
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        }),
    ),
  );
});
