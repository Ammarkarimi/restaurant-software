// Keeps the offline billing screen working when the internet drops.
// - /_next/static files (code, styles) are kept after the first load (their names change on every release).
// - /offline (the offline billing screen) is saved whenever the app asks ("warm").
// - Any page opened while offline shows the offline billing screen instead of an error.
const SHELL = "restaurant-shell-v1";

async function warm() {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch("/offline", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || res.redirected) return;
    await cache.put("/offline", res.clone());
    const html = await res.text();
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
    await Promise.all(assets.map((a) => cache.match(a).then((hit) => hit || cache.add(a)).catch(() => undefined)));
  } catch {
    // offline right now: keep what we have
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(warm());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== SHELL) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "warm") event.waitUntil(warm());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match("/offline");
        return cached || new Response("<h1>You are offline</h1><p>Open the app once while online so offline billing can be saved on this device.</p>", { headers: { "Content-Type": "text/html" } });
      })
    );
  }
});
