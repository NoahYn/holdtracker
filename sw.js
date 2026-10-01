/* HoldTracker service worker
   - 같은 오리진(앱 셸): network-first  → 배포하면 바로 최신 버전이 반영됨
   - CDN(포즈 모델/wasm): cache-first   → 한 번 받으면 오프라인/데이터 절약
*/
const CACHE = "holdtracker-flexibility-v6";
const SHELL = ["./", "./index.html", "./front-tracking.js", "./workout-video.js", "./flexibility.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCDN = url.hostname === "cdn.jsdelivr.net" || url.hostname === "storage.googleapis.com";
  if (!sameOrigin && !isCDN) return;

  if (isCDN) {
    // cache-first: 모델(수 MB)과 wasm은 바뀌지 않으므로 한 번만 받으면 됨
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
      )
    );
    return;
  }

  // network-first: 앱 셸은 항상 최신, 오프라인이면 캐시로 폴백
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
