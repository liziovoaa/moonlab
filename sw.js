/* sw.js —— MoonLab 离线缓存
 * 目的：公网首访要下载约 19MB（three 1.2MB + wasm 9MB + 手势模型 7.5MB），
 *      缓存之后第二次打开几乎秒开，并且断网也能用。
 * 策略：
 *   - 页面（index.html）：网络优先，保证能拿到新版本；断网时回退缓存。
 *   - vendor 大文件：缓存优先，后台补齐。安装时不预下载，避免首访就吃掉 19MB。
 * 更新办法：改了 index.html 或 vendor 后，把下面的 CACHE 版本号 +1。
 */
const CACHE = 'moonlab-v1';
const SHELL = ['./index.html', './'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面：网络优先
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      });
    })
  );
});
