const CACHE_NAME = 'eduboard-v2'; // Incrementato per forzare aggiornamento
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened successfully');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] All resources cached');
        // Forza l'attivazione immediata del nuovo SW
        return self.skipWaiting();
      })
  );
});

// Intercettazione delle richieste con strategia ibrida
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Strategia Network-First per le richieste di navigazione (HTML)
  if (request.mode === 'navigate' || 
      (request.method === 'GET' && request.headers.get('accept').includes('text/html'))) {
    
    console.log('[SW] Network-first strategy for:', request.url);
    
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Se la richiesta di rete ha successo
          if (response && response.status === 200) {
            console.log('[SW] Network response successful, updating cache');
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          }
          
          // Se la risposta non è valida, prova la cache
          return caches.match(request);
        })
        .catch(() => {
          // Se la rete fallisce, usa la cache
          console.log('[SW] Network failed, serving from cache');
          return caches.match(request);
        })
    );
  } 
  // Strategia Cache-First per tutte le altre risorse (CSS, JS, immagini, ecc.)
  else {
    console.log('[SW] Cache-first strategy for:', request.url);
    
    event.respondWith(
      caches.match(request)
        .then((response) => {
          // Restituisce la risorsa dalla cache se disponibile
          if (response) {
            console.log('[SW] Serving from cache:', request.url);
            return response;
          }
          
          // Altrimenti, effettua la richiesta di rete
          console.log('[SW] Not in cache, fetching from network:', request.url);
          return fetch(request).then((response) => {
            // Controlla se la risposta è valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta e mettila in cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
        })
    );
  }
});

// Aggiornamento del Service Worker e notifica ai client
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new Service Worker...');
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    Promise.all([
      // Pulisci le vecchie cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendi il controllo di tutti i client immediatamente
      self.clients.claim().then(() => {
        console.log('[SW] Service Worker now controls all clients');
        
        // Notifica tutti i client che una nuova versione è disponibile
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            console.log('[SW] Notifying client about update');
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              message: 'Una nuova versione di EduBoard è disponibile!'
            });
          });
        });
      })
    ])
  );
});

// Gestione dei messaggi dai client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});