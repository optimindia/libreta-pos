import type { Metadata, Viewport } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'
import '../ui/sistema/pulido-final.css'
import '../ui/sistema/mosaico.css'
import '../ui/sistema/nativo.css'
import '../ui/sistema/legal.css'
// Sistema F: va al final para que sus reglas manden sobre las capas viejas.
import '../ui/sistema/f/tokens.css'
import '../ui/sistema/f/componentes.css'
import '../ui/sistema/f/navegacion.css'
import '../ui/sistema/f/estados.css'
import '../ui/sistema/f/portada.css'
import '../ui/sistema/f/accesibilidad.css'
import '../ui/vender/vender.css'
import '../ui/inicio/inicio.css'
import '../ui/plata/plata.css'
import '../ui/historial/historial.css'
import '../ui/ticket/ticket.css'
import { RegistrarSW } from '@/ui/sistema/RegistrarSW'
import { Sincronizador } from '@/ui/sistema/Sincronizador'
import { TemaInicial } from '@/ui/sistema/TemaInicial'
import { ControlAcceso } from '@/ui/sistema/ControlAcceso'
import { SaltarAlContenido } from '@/ui/sistema/SaltarAlContenido'

// Una sola letra en toda la app. Si no carga, queda la del sistema.
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-figtree',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
})

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
    { media: '(prefers-color-scheme: light)', color: '#F1F4F2' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1513' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-tema="claro" className={figtree.variable}>
      <body className={figtree.className}>
        <SaltarAlContenido />
        <RegistrarSW />
        <Sincronizador />
        <TemaInicial />
        <ControlAcceso>{children}</ControlAcceso>
      </body>
    </html>
  )
}
