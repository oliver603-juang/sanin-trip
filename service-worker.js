const APP_VERSION = '38'; // 與 index.html 的 ?v= 保持一致
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
  // cache.addAll 是全有或全無：同站檔案必須成功；跨站 CDN 逐一快取、失敗就略過。
  // 跨站先用 cors 抓（unpkg／jsdelivr／Google Fonts 都支援，存起來是可讀的 cors 回應，
  // 之後 <script crossorigin> 才吃得到）；不支援 CORS 的（cdn.tailwindcss.com）才退回 no-cors 的 opaque。
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const local = ASSETS_TO_CACHE.filter((u) => u.startsWith('./'));
      const remote = ASSETS_TO_CACHE.filter((u) => !u.startsWith('./'));
      await cache.addAll(local);
      await Promise.allSettled(remote.map(async (u) => {
        try {
          const r = await fetch(u, { mode: 'cors' });
          if (r.ok) { await cache.put(u, r); return; }
        } catch (e) {}
        try {
          const r = await fetch(new Request(u, { mode: 'no-cors' }));
          await cache.put(u, r);
        } catch (e) {}
      }));
    })
  );
});

// 能不能把快取回應交給這個請求：opaque（no-cors 存的）只能給 no-cors 請求，
// 給 <script crossorigin>（cors 請求）會被瀏覽器當成網路錯誤 → React is not defined
const usable = (req, res) => !!res && !(res.type === 'opaque' && req.mode === 'cors');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  const isNetworkFirst = NETWORK_FIRST.some((f) => url.includes(f));
  const sameOrigin = url.startsWith(self.location.origin);

  if (isNetworkFirst) {
    // 同站主程式：先抓網路（永遠拿最新），失敗退回快取
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)); }
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }
  // 函式庫與圖片：先快取、沒有（或快取不能用）才抓網路，抓到就補進快取
  event.respondWith(
    caches.match(req).then((cached) => {
      if (usable(req, cached)) return cached;
      return fetch(req).then((response) => {
        if (response && (response.ok || (response.type === 'opaque' && req.mode === 'no-cors'))) {
          const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached || Response.error());
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n !== CACHE_NAME ? caches.delete(n) : null))
    ).then(() => self.clients.claim()) // 立即控制所有頁面
  );
});
