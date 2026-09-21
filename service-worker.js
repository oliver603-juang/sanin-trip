const CACHE_NAME = 'trip-2027-sanin-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './manifest.json',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@500&display=swap'
];

// Network-first for config & app (always get latest), cache-first for libs
const NETWORK_FIRST = ['config.js', 'app.js', 'manifest.json', 'index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 立即啟用新 SW
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
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
