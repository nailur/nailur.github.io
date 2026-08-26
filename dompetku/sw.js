const CACHE_NAME = 'dompetku-cache-v1';
const ASSETS = [
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/modals.css',
    './js/app.js',
    './js/auth.js',
    './js/state.js',
    './js/utils.js',
    './js/wallets.js',
    './js/categories.js',
    './js/transactions.js',
    './js/budgets.js',
    './js/dashboard.js',
    './js/reports.js',
    './js/telegram.js',
    './js/supabase.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Cache First for static assets, Network First for API calls
    if (event.request.url.includes('supabase.co')) {
        return; // Don't cache Supabase database API requests
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});

