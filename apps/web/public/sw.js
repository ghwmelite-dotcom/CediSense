const CACHE_VERSION = 'v3';
const STATIC_CACHE = `cedisense-static-${CACHE_VERSION}`;
const API_CACHE = `cedisense-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `cedisense-images-${CACHE_VERSION}`;

// App shell — pre-cached on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API routes to cache (stale-while-revalidate)
const CACHEABLE_API_PREFIXES = [
  '/api/v1/dashboard',
  '/api/v1/transactions',
  '/api/v1/accounts',
  '/api/v1/categories',
  '/api/v1/budgets',
  '/api/v1/goals',
  '/api/v1/recurring',
  '/api/v1/insights',
];

// Never cache these
const NEVER_CACHE = [
  '/api/v1/auth',
  '/api/v1/ai',
  '/api/v1/export',
];

// ── INSTALL ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

// ── ACTIVATE ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── MESSAGE (skip waiting on demand) ─────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip never-cache routes
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // API requests → Stale-While-Revalidate
  if (CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Skip uncacheable API routes
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (hashed filenames from Vite) → Cache-First
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Images → Cache-First
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Navigation (HTML) → Network-First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else → Network-First
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ── STRATEGIES ───────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback for navigation — serve the SPA shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }

    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || offlineResponse());

  return cached || fetchPromise;
}

function offlineResponse() {
  return new Response(
    JSON.stringify({ error: { code: 'OFFLINE', message: 'You are offline' } }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}
