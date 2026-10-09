// BIG IF service worker — cache-first for the app shell so it works offline
// once installed. Bump CACHE_V when shipping changes so clients refresh.
const CACHE_V = "bigif-v8";
const SHELL = ["./", "index.html", "styles.css", "app.js", "questions.js", "icons.js", "manifest.json", "fonts/PatrickHand-Regular.ttf"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_V).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname.includes("firestore")) return; // stats always live
  if (url.pathname.split("/").pop().startsWith("_")) return; // dev/test files: never cache
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.origin === location.origin }).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_V).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
