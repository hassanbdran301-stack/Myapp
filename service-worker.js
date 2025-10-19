// اسم الكاش
const CACHE_NAME = 'hassan-cache-v1';

// الملفات التي سيتم حفظها للعمل بدون إنترنت
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json'
];

// تثبيت الخدمة وتخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// جلب الملفات من الكاش أو من الإنترنت
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// تحديث الكاش إذا تغيرت الملفات
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
