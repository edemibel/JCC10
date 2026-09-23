/* =========================================================================
   SERVICE WORKER - JUZGADO PÚBLICO CIVIL Y COMERCIAL N° 10 (PWA)
   Caché Offline-First y Resiliencia en Red Judicial
   ========================================================================= */

const CACHE_NAME = 'jcc10-audiencias-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/favicon.png',
  './icons/icon.svg'
];

// ── Instalación: Precachear recursos vitales ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activación: Limpieza de cachés antiguas ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Intercepción de Peticiones: Estrategia Caché con Fallback de Red ──────
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo peticiones GET
  if (request.method !== 'GET') return;

  // Recursos de fuentes externas (Google Fonts, FontAwesome CDN)
  if (request.url.includes('googleapis.com') || 
      request.url.includes('gstatic.com') || 
      request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Recursos locales de la aplicación (Stale-While-Revalidate o Cache-First)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano actualizamos el caché si hay red disponible
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => { /* Sin red, usamos caché */ });

        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Si es navegación HTML y estamos offline, servir index.html precacheado
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
