const CACHE_NAME = 'inventory-checkout-cache-v1';
const urlsToCache = [
  '/',
  '/employee.html',
  '/admin.html',
  '/style.css',
  '/employee.js',
  '/admin.js',
  '/logo.png',
  '/manifest.json'
];

// Install event: Pre-cache application shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: Respond with cached resources or fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});