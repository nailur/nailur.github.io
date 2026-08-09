importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'pos-cache-v115';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/style-modals.css',
  './js/app.js',
  './js/utils.js',
  './js/users.js',
  './js/checkout.js',
  './js/auth.js',
  './js/printer.js',
  './js/history.js',
  './js/cart.js',
  './js/state.js',
  './js/products.js',
  './js/shift.js',
  './js/modifiers.js',
  './js/hpp.js',
  './js/discounts.js',
  './js/offline.js',
  // --- Offline required modules (Audit Fix #1) ---
  './js/attendance.js',
  './js/affiliate.js',
  './js/dashboard.js',
  './js/deposits.js',
  './js/expenses.js',
  './js/inventory.js',
  './js/management.js',
  './js/shift-master.js',
  './js/shift-sessions.js',
  './js/supabase.js',
  './manifest.json',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/lib/supabase.min.js',
  './assets/lib/browser-image-compression.js',
  'https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/style.css',
  'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// App shell = files that change frequently (JS/CSS/HTML)
function isAppShell(url) {
  const path = new URL(url).pathname;
  return path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // API requests — do not cache, fetch directly from network
  if (url.includes('supabase.co') || url.includes('api.github.com')) return;

  if (isAppShell(url)) {
    // NETWORK-FIRST: Always fetch latest version, fallback to cache when offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CACHE-FIRST: For static assets (icons, images, fonts, manifest)
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          });
        })
    );
  }
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      let hasOldCache = false;
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1 && cacheName.startsWith('pos-cache-')) {
            hasOldCache = true;
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        if (hasOldCache) {
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'APP_UPDATED', version: CACHE_NAME });
            });
          });
        }
      });
    }).then(() => clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
