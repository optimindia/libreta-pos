const CACHE = 'libreta-v1'

// Sólo el armazón: los datos viven en IndexedDB, no en el caché.
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])))
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave))),
    ),
  )
  self.clients.claim()
})

// Red primero, caché de respaldo: la app siempre abre, con o sin señal.
// Nunca se cachea una respuesta con error, para no dejar la app rota.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return
  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(evento.request, copia))
        }
        return respuesta
      })
      .catch(() => caches.match(evento.request).then((guardada) => guardada ?? caches.match('/'))),
  )
})
