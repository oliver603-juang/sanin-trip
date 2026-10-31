const APP_VERSION = '33'; // 與 index.html 的 ?v= 保持一致
const CACHE_NAME = 'trip-2027-sanin-v' + APP_VERSION;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js?v=' + APP_VERSION,
  './config.js?v=' + APP_VERSION,
  './manifest.json',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.9/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@500&display=swap'
];

// Network-first for config & app (always get latest), cache-first for libs
const NETWORK_FIRST = ['config.js', 'app.js', 'manifest.json', 'index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 立即啟用新 SW
  // 注意：cache.addAll 是全有或全無，第三方 CDN（例如 cdn.tailwindcss.com 沒有 CORS 標頭）
  // 任何一個抓不到就整包失敗、SW 永遠裝不起來、離線快取等於沒有。
  // 改成：同站檔案必須成功；跨站資源用 no-cors 逐一快取、失敗就略過。
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const local = ASSETS_TO_CACHE.filter((u) => u.startsWith('./'));
      const remote = ASSETS_TO_CACHE.filter((u) => !u.startsWith('./'));
      await cache.addAll(local);
      await Promise.allSettled(remote.map((u) =>
        fetch(new Request(u, { mode: 'no-cors' })).then((res) => cache.put(u, res)).catch(() => null)
      ));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isNetworkFirst = NETWORK_FIRST.some(f => url.includes(f));

  if (isNetworkFirst) {
    // Network first: try server, fallback to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first: use cache, fallback to network
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n !== CACHE_NAME ? caches.delete(n) : null))
    ).then(() => self.clients.claim()) // 立即控制所有頁面
  );
});
