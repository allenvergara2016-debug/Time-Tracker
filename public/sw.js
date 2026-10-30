// Service Worker for Time Tracker PWA
const CACHE_NAME = 'time-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle API requests and dynamic data
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Standard fetch pass-through
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

