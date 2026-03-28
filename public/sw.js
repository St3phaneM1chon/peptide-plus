/**
 * Service Worker for Koraline PWA (tenant-aware)
 * - Cache-first for static assets (CSS, JS, images, fonts, icons)
 * - Network-first for API calls (with cache fallback)
 * - Network-first for dynamic content (product pages, etc.)
 * - Offline fallback page for navigation requests
 * - Push notification handler
 */

const CACHE_VERSION = 'v4';
const STATIC_CACHE = `koraline-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `koraline-dynamic-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Static assets to precache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-96.png',
];

// ---------------------------------------------------------------------------
// Install: precache static assets
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
      })
  );
});

// ---------------------------------------------------------------------------
// Activate: clean up old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (cacheName.startsWith('koraline-') || cacheName.startsWith('biocycle-'))
                && !cacheName.endsWith(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch: routing strategies
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations always go to network)
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Dynamic manifest: always network-first (tenant-specific)
  if (url.pathname === '/manifest.json' || url.pathname.endsWith('/manifest')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // API requests: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js build assets: Network-first (content-hashed, Turbopack manages caching)
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (images, fonts, CSS, JS): Cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages: Network-first with offline fallback
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// ---------------------------------------------------------------------------
// Cache-first strategy (static assets)
// ---------------------------------------------------------------------------

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Network-first strategy (API calls, dynamic content)
// ---------------------------------------------------------------------------

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Return a JSON error response for offline API calls
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Offline', code: 'OFFLINE' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Network-first with offline fallback (HTML pages)
// ---------------------------------------------------------------------------

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Try cache
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Fall back to offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_PAGE);
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Messages from client
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SYNC_QUEUE') {
    console.log('[SW] Sync queue triggered');
  }
});

// ---------------------------------------------------------------------------
// Background sync for offline mutations
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_QUEUE' }));
      })
    );
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = { title: 'Koraline', body: 'New notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Koraline', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Koraline', options)
  );
});

// ---------------------------------------------------------------------------
// Notification click handler
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      })
  );
});
