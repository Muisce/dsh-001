/* 化学实验室安全题库 · Service Worker
   策略：HTML 网络优先（微信/QQ 强缓存下保证更新），静态资源缓存优先；
   install 时预缓存全部核心资源；版本号化缓存，activate 清理旧缓存。 */
var CACHE = 'dsh001-bank-v1';
var CORE = [
  './',
  './index.html',
  './bank.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(CORE).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('dsh001-') === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isDoc = req.mode === 'navigate' || /index\.html$/.test(url.pathname) || /\/$/.test(url.pathname);

  if (isDoc) {
    /* 网络优先，超时回退缓存；避免微信 X5 强缓存导致旧页面 */
    e.respondWith((async function () {
      try {
        var fresh = await fetch(req);
        if (fresh && fresh.ok) {
          var c = await caches.open(CACHE);
          c.put('./index.html', fresh.clone());
          return fresh;
        }
      } catch (err) {}
      var c2 = await caches.open(CACHE);
      return (await c2.match('./index.html')) || (await c2.match('./')) ||
        new Response('当前无网络且无离线缓存，请联网打开一次。', {
          status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    })());
  } else {
    /* 资源缓存优先，后台更新 */
    e.respondWith((async function () {
      var c = await caches.open(CACHE);
      var cached = await c.match(req);
      var update = fetch(req).then(function (r) {
        if (r && r.ok) c.put(req, r.clone());
      }).catch(function () {});
      if (cached) { e.waitUntil(update); return cached; }
      await update;
      return (await c.match(req)) || fetch(req);
    })());
  }
});
