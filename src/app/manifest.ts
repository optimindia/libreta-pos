import type { MetadataRoute } from 'next'

/** Libreta se instala como una app: ícono propio, ventana sin barra del
 *  navegador y accesos directos al mantener apretado el ícono. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Libreta — tu almacén',
    short_name: 'Libreta',
    description: 'Vendé, anotá fiados y controlá tu stock. Funciona sin internet.',
    lang: 'es-AR',
    dir: 'ltr',
    start_url: '/?origen=app',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#F1F4F2',
    theme_color: '#0B6B52',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Vender', short_name: 'Vender', url: '/vender', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Fiados', short_name: 'Fiados', url: '/fiados', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Stock', short_name: 'Stock', url: '/stock', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Plata', short_name: 'Plata', url: '/plata', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
