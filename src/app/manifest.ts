import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Libreta',
    short_name: 'Libreta',
    description: 'Tu almacén, en tu celu',
    start_url: '/',
    display: 'standalone',
    background_color: '#FCFBF8',
    theme_color: '#12694E',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
