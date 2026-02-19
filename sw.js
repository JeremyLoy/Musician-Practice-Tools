// Service Worker — Network-first strategy
// Always tries the network first; falls back to cache only when offline.
// This ensures refreshes always get the latest version when online.

const CACHE_NAME = 'musician-toolkit-v1';

// Assets to pre-cache on install (shell only)
const PRECACHE_URLS = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  // Skip waiting so the new SW activates immediately on install
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  // Delete any old caches from previous SW versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests and local assets: network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache successful same-origin or cdn responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
