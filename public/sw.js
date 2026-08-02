const ORION_CACHE = 'orion-shell-v2'
const SHELL = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ORION_CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== ORION_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
))

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone()
      caches.open(ORION_CACHE).then((cache) => cache.put(event.request, copy))
      return response
    }).catch(() => caches.match(event.request)))
    return
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})
