const CACHE_NAME = 'esg-report-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './templates.js',
  './practice-guide.js',
  './references.js',
  './storage.js',
  './docx-export.js',
  './manifest.json'
];

// 安裝時快取所有核心資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 啟用時清除舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 攔截請求：快取優先，離線可用
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Claude API 請求不快取，直接放行（需連網）
  if (url.hostname.includes('anthropic.com')) {
    return;
  }

  // CDN 資源：先網路後快取
  if (url.hostname.includes('cdnjs') || url.hostname.includes('jsdelivr') || url.hostname.includes('unpkg')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 本地資源：快取優先
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
