import type { Metadata, Viewport } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'
import '../ui/sistema/pulido-final.css'
import '../ui/sistema/mosaico.css'
import '../ui/sistema/nativo.css'
import '../ui/sistema/legal.css'
import { RegistrarSW } from '@/ui/sistema/RegistrarSW'
import { Sincronizador } from '@/ui/sistema/Sincronizador'
import { TemaInicial } from '@/ui/sistema/TemaInicial'
import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

const sora = Sora({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Libreta',
  description: 'Vendé, anotá fiados y controlá tu stock. Funciona sin internet.',
  applicationName: 'Libreta',
  appleWebApp: { capable: true, title: 'Libreta', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  // La barra del sistema toma el color del fondo de la app en cada tema.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF1F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-tema="claro">
      <body className={sora.className}>
        <RegistrarSW />
        <Sincronizador />
        <TemaInicial />
        <ControlAcceso>{children}</ControlAcceso>
      </body>
    </html>
  )
}
