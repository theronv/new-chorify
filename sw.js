const CACHE_NAME = 'chorify-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/lib/supabase.js',
  '/src/lib/store.js',
  '/src/lib/db.js',
  '/src/styles/main.css',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  // Network first for API calls
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  // Cache first for static assets
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      }))
      .catch(() => caches.match('/index.html'))
  );
});
