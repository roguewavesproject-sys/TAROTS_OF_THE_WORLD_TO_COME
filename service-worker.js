const CACHE_NAME = "tarocchi-mondo-v2";

const CORE = [
  "./",
  "./index.html",
  "./deck.json",
  "./manifest.webmanifest",
  "./assets/dorso_tarocchi.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

async function cacheIfAvailable(cache, url) {
  try {
    const response = await fetch(url);
    if (response.ok) await cache.put(url, response.clone());
  } catch (_) {}
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);

    await cacheIfAvailable(cache, "./assets/ambient.mp3");

    try {
      const deckResponse = await fetch("./deck.json");
      if (deckResponse.ok) {
        const deck = await deckResponse.json();
        await Promise.allSettled(
          (deck.cards || [])
            .map(card => card.image)
            .filter(Boolean)
            .map(url => cacheIfAvailable(cache, "./" + url.replace(/^\.\//, "")))
        );
      }
    } catch (_) {}
  })());

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
