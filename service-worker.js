const CACHE_NAME = "tarocchi-mondo-v1-3-audio-fix";

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

  // L'audio e le richieste Range vengono gestiti direttamente dal browser.
  if (url.pathname.endsWith("/assets/ambient.mp3") || event.request.headers.has("range")) {
    return;
  }

  const isAppData =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/deck.json");

  if (isAppData) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: "no-store" });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? (await caches.match("./index.html")) || (await caches.match("./"))
            : Response.error())
        );
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
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
