importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'pos-cache-v29';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/style-modals.css',
  './js/app.js',
  './js/auth.js',
  './js/printer.js',
  './js/history.js',
  './js/cart.js',
  './js/state.js',
  './js/products.js',
  './js/shift.js',
  './js/modifiers.js',
  './js/discounts.js',
  './js/offline.js',
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

// App shell = file yang sering berubah (JS/CSS/HTML)
function isAppShell(url) {
  const path = new URL(url).pathname;
  return path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // API requests — jangan di-cache, langsung ke network
  if (url.includes('supabase.co') || url.includes('api.github.com')) return;

  if (isAppShell(url)) {
    // NETWORK-FIRST: Selalu ambil versi terbaru, fallback ke cache saat offline
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
    // CACHE-FIRST: Untuk aset statis (icon, gambar, font, manifest)
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
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      clients.claim()
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
