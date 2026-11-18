/* 解析版离线缓存：cache-first + 后台更新（stale-while-revalidate） */
var CACHE = 'safety-quiz-gh-v2';
var SCOPE = '/dsh-001/';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(['./', './index.html']); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(SCOPE) !== 0) return;

  var isDoc = req.mode === 'navigate' || /\/$/.test(url.pathname) || /index\.html$/.test(url.pathname);
  var key = isDoc ? new Request('./index.html') : req;

  e.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var cached = await cache.match(key, { ignoreSearch: true });
    var update = fetch(req)
      .then(function (r) { if (r && r.ok) return cache.put(key, r.clone()); })
      .catch(function () {});
    if (cached) { e.waitUntil(update); return cached; }
    await update;
    var fresh = await cache.match(key, { ignoreSearch: true });
    return fresh || new Response('当前离线且无缓存，请联网后再打开一次。', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
