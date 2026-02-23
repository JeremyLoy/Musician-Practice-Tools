// ─── SERVICE WORKER — Musician's Practice Toolkit ────────────────────────────
//
// HOW UPDATES WORK:
//   When you deploy changes to any app file, update CACHE_VERSION below to the
//   current date+time (e.g. 'toolkit-20260222-1430'). On the user's next visit,
//   the browser detects that sw.js changed, installs the new service worker,
//   downloads fresh copies of all assets, and deletes the old cache. Users get
//   updates automatically on next page load after closing and reopening the tab.
//
//   IMPORTANT: Also update APP_VERSION in app.js to the same string so the
//   footer displays the correct version. Always bump both when deploying.

const CACHE_VERSION = 'toolkit-20260223-1200';

// Every file the app needs to work offline.
// If you add a new file to docs/, add it to this list too.
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './dictionary.js',
  './dict.js',
  './tuner.js',
  './recorder.js',
  './wavesurfer.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
// Fires once when the service worker is first registered, or when sw.js changes.
// Downloads and caches every asset listed above so the app works offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  // Take over immediately — don't wait for old tabs to close.
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Fires after install, once the old service worker (if any) is gone.
// Deletes caches from previous versions (e.g. 'toolkit-v0').
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of already-open pages immediately.
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
// Fires on every network request the page makes.
// Strategy: cache-first for everything.
//   1. Look in the cache — if found, return instantly (no network needed).
//   2. If not found, fetch from network, store in cache, return response.
//      (This handles any URLs not in the initial ASSETS list.)
self.addEventListener('fetch', event => {
  // Only handle GET requests — POST etc. always go straight to network.
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) schemes (e.g. chrome-extension://).
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache: fetch from network and store for next time.
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const toStore = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toStore));
        return response;
      });
    })
  );
});
