// Libreta offline: el armazón de la app queda guardado para abrir sin señal.
// Los datos viven en IndexedDB, nunca en este caché.
const CACHE = 'libreta-v2'
const ARMAZON = ['/', '/vender', '/fiados', '/stock', '/plata', '/manifest.webmanifest', '/icon-192.png']

/** Guarda la pantalla y los archivos con huella que ella pide (/_next/static).
 *  Sin esto, una pantalla que nunca se abrió con señal tiene su HTML guardado
 *  pero no su código, y sin internet termina en "This page couldn't load". */
async function guardarPantalla(cache, ruta) {
  try {
    const respuesta = await fetch(ruta)
    if (!respuesta.ok) return
    await cache.put(ruta, respuesta.clone())
    if (!(respuesta.headers.get('content-type') || '').includes('text/html')) return
    const html = await respuesta.text()
    const archivos = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || [])
    await Promise.all([...archivos].map((archivo) => cache.add(archivo).catch(() => undefined)))
  } catch {
    // sin señal durante la instalación: se guardará al visitarla
  }
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(ARMAZON.map((ruta) => guardarPantalla(cache, ruta)))),
  )
  // La versión nueva no se activa sola acá: espera a que la
  // pantalla avise ("Hay una versión nueva" → Actualizar), así nunca cambia
  // el código de la app en medio de una venta.
})

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (evento) => {
  const { request } = evento
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Sólo lo propio: nada de Supabase ni de otros dominios, y nunca la API
  // (sus respuestas dependen de quién está logueado).
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/webpack-hmr')) return

  // Archivos con huella (no cambian nunca): primero el caché.
  if (url.pathname.startsWith('/_next/static/')) {
    evento.respondWith(
      caches.match(request).then((guardada) => guardada ?? fetch(request).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
        }
        return respuesta
      })),
    )
    return
  }

  // Todo lo demás: red primero y, sin señal, lo último guardado. Una página
  // que nunca se abrió cae al inicio, que funciona igual sin internet.
  evento.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok && respuesta.type === 'basic') {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
        }
        return respuesta
      })
      .catch(() =>
        caches.match(request).then((guardada) => guardada ?? (request.mode === 'navigate' ? caches.match('/') : Response.error())),
      ),
  )
})
