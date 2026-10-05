const CACHE_NAME = 'xb-notes-v1';
const STATIC = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/notes.json',
  './data/categories.json',
  './data/areas.json',
  './data/daily-stats.json',
  './data/meta.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 网络优先，失败回退缓存
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, copy);
        });
        return res;
      })
      .catch(() => caches.match(req).then(r => r))
  );
});
