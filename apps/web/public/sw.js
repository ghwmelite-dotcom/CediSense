const CACHE_NAME = 'cedisense-v2';
const API_CACHE = 'cedisense-api-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// API paths to cache (stale-while-revalidate)
const CACHEABLE_API = [
  '/api/v1/dashboard',
  '/api/v1/transactions',
  '/api/v1/accounts',
  '/api/v1/categories',
  '/api/v1/budgets',
  '/api/v1/goals',
  '/api/v1/recurring',
  '/api/v1/insights',
];

// API paths to NEVER cache
const SKIP_CACHE_API = [
  '/api/v1/auth',
  '/api/v1/ai',
  '/api/v1/export',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (mutations handled by app-layer sync queue)
  if (event.request.method !== 'GET') return;

  // Check if it's a cacheable API request
  const isAPI = url.pathname.startsWith('/api/');
  const isCacheableAPI = CACHEABLE_API.some((p) => url.pathname.startsWith(p));
  const isSkipAPI = SKIP_CACHE_API.some((p) => url.pathname.startsWith(p));

  if (isAPI && isSkipAPI) {
    // Never cache auth/ai/export — pass through
    return;
  }

  if (isAPI && isCacheableAPI) {
    // Stale-while-revalidate for API GETs
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);

        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Network failed — return cached or offline error
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: { code: 'OFFLINE', message: 'You are offline' } }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });

        // Return cached immediately if available, otherwise wait for network
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets — cache-first
  if (!isAPI) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
