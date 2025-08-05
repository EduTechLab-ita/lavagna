const CACHE_NAME = 'lavagna-pwa-cache-v2';
const urlsToCache = [
    '/lavagna/',
    '/lavagna/index.html',
    '/lavagna/style.css',
    '/lavagna/app.js',
    '/lavagna/manifest.json',
    '/lavagna/images/icon-192x192.png', // Aggiungiamo le icone principali alla cache
    '/lavagna/images/icon-512x512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.102/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.102/pdf.worker.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME )
            .then(cache => {
                console.log('Cache aperta');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
