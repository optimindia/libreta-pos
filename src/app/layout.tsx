import type { Metadata, Viewport } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'
import '../ui/sistema/pulido-final.css'
import '../ui/sistema/mosaico.css'
import { RegistrarSW } from '@/ui/sistema/RegistrarSW'
import { Sincronizador } from '@/ui/sistema/Sincronizador'
import { TemaInicial } from '@/ui/sistema/TemaInicial'
import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

const sora = Sora({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Libreta',
  description: 'Tu almacén, en tu celu',
}

export const viewport: Viewport = {
  themeColor: '#0A6F5A',
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
