/* ============================================================
   SALAH PULSE – sw.js (Service Worker)
   Caches app shell for offline use.
   Network-first for API calls, Cache-first for assets.
   ============================================================ */

const CACHE_NAME = 'salah-pulse-v1';

// Files to cache for offline shell
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=Amiri:wght@400;700&display=swap',
];

// ─── Install: cache shell assets ─────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching shell assets');
      // Use individual adds so one failure doesn't break all
      return Promise.allSettled(
        SHELL_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e)))
      );
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: strategy routing ─────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls: network-first with cache fallback
  if (url.hostname.includes('aladhan.com') || url.hostname.includes('nominatim')) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // App shell & fonts: cache-first
  event.respondWith(cacheFirst(event.request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page or empty response
    return new Response('<h2>Offline – Salah Pulse</h2><p>Your last known prayer times are still available.</p>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Network-first strategy (for API)
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ code: 503, status: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
