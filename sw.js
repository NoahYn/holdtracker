/* HoldTracker service worker
   - 같은 오리진(앱 셸): network-first  → 배포하면 바로 최신 버전이 반영됨
   - CDN(포즈 모델/wasm): cache-first   → 한 번 받으면 오프라인/데이터 절약

   Cache naming: every cache this worker owns is prefixed with "holdtracker-"
   so activate() never touches caches belonging to other apps that might
   share this GitHub Pages origin (e.g. noahyn.github.io/other-project).
*/
const CACHE_PREFIX = "holdtracker-";
const CACHE = "holdtracker-flexibility-expert-v8";

// Required app-shell files. If any of these fail to download, installation
// must fail (reject) so an incomplete cache never becomes active.
const REQUIRED_SHELL = ["./", "./index.html", "./front-tracking.js", "./workout-video.js", "./flexibility.js", "./manifest.webmanifest"];
// Best-effort assets: nice to have offline, but a missing icon shouldn't
// block installation.
const OPTIONAL_SHELL = ["./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) =>
        // Required files: addAll is all-or-nothing, so any 404/network
        // failure rejects the whole install and the old SW stays active.
        c.addAll(REQUIRED_SHELL).then(() =>
          // Optional files: best-effort, failures are swallowed.
          Promise.allSettled(OPTIONAL_SHELL.map((u) => c.add(u)))
        )
      )
      // Only skip waiting once the required shell is confirmed cached.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) =>
        Promise.all(
          ks
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
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

  const isNavigation = req.mode === "navigate";

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
      .catch(() => {
        // Ignore the query string for navigations so e.g. "./?foo=1" still
        // matches the cached "./" / "./index.html" entry.
        const matchOptions = isNavigation ? { ignoreSearch: true } : undefined;
        return caches.match(req, matchOptions).then((hit) => {
          if (hit) return hit;
          // Only navigations fall back to the app shell page. A missing
          // script/style/asset must not silently resolve as index.html.
          if (isNavigation) {
            return caches.match("./index.html", { ignoreSearch: true }).then((shell) =>
              shell || new Response("Offline", { status: 503, statusText: "Offline" })
            );
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
  );
});
