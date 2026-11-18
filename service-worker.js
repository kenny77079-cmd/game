/* 神域之門 service worker（V1.4.187）
   - index.html／頁面：網路優先（有網路就拿最新版，離線才用快取）→ 更新遊戲只要換 index.html
   - assets.bin?v=版本：快取優先（版本號變了才重新下載，舊版本自動清掉）
   - 其他同網域檔案（圖示、manifest、og.jpg）：快取優先，背景更新 */
const CACHE = "realm-gate-v3";
/* 安裝時先把頁面與目前版本的素材檔存起來，第一次開過之後就能離線遊玩 */
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async c => {
    try {
      const res = await fetch("./index.html", { cache: "no-store" });
      if (!res.ok) return;
      const html = await res.clone().text();
      await c.put(new Request(new URL("./index.html", self.registration.scope).pathname), res);
      const m = html.match(/var VER="(\w+)"/);
      if (m) { const u = "./assets.bin?v=" + m[1]; if (!(await c.match(u))) await c.add(u); }
      await c.addAll(["./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-180.png"]).catch(() => {});
    } catch (_) {}
  }));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  const isAssets = url.pathname.endsWith("/assets.bin");
  if (isPage) {
    e.respondWith(fetch(req, { cache: "no-store" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(new Request(url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname), copy)); }
      return res;
    }).catch(() => caches.match(url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname).then(r => r || caches.match(req))));
    return;
  }
  if (isAssets) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        c.keys().then(keys => keys.forEach(k => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }));
        c.put(req, copy);
      }
      return res;
    }))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
