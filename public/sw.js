// Service Worker for Game Gambit PWA
// Handles offline functionality, caching, and push notifications

const CACHE_NAME = 'gamegambit-v1'
const urlsToCache = [
  '/',
  '/logo.png',
  '/favicon.ico',
  '/manifest.json',
]

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
  // Skip waiting to activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - implement cache-first strategy for assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // API calls - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((response) => {
            return (
              response ||
              new Response('Offline - resource not available', {
                status: 503,
                statusText: 'Service Unavailable',
              })
            )
          })
        })
    )
    return
  }

  // Static assets - cache first, fallback to network
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.wasm')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache)
              })
            }
            return networkResponse
          })
        )
      })
    )
    return
  }

  // HTML pages - network first for fresh content
  if (request.destination === '' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Try to return cached response
          return caches
            .match(request)
            .then((response) => {
              return (
                response ||
                new Response('Offline - page not available', {
                  status: 503,
                  statusText: 'Service Unavailable',
                })
              )
            })
        })
    )
    return
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request)
    })
  )
})

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  const data = event.data.json()
  const options = {
    body: data.body || 'New notification from Game Gambit',
    icon: '/logo.png',
    badge: '/favicon.ico',
    tag: data.tag || 'gamegambit-notification',
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      ...data,
    },
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Game Gambit', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if window is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Optional: track analytics for dismissed notifications
  console.log('Notification dismissed:', event.notification.tag)
})

// Background sync for offline wager creation
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-wagers') {
    event.waitUntil(
      // Handle offline wager sync
      fetch('/api/wagers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch((err) => {
        console.error('Sync failed:', err)
        // Retry sync if failed
        return self.registration.sync.register('sync-wagers')
      })
    )
  }
})

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME })
  }
})
