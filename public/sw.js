const CACHE = 'lunar-calendar-v1'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('./')).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lunar-calendar-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('message', event => {
  if (!Array.isArray(event.data?.assets)) return
  const assets = event.data.assets.filter(url => typeof url === 'string' && new URL(url, self.location.href).origin === self.location.origin)
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(assets.map(url => cache.add(url)))))
})
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
    return response
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./') : undefined) || Response.error()))
})
