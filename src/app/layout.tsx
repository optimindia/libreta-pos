import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'
import { Navegacion } from '@/ui/sistema/Navegacion'
import { RegistrarSW } from '@/ui/sistema/RegistrarSW'
import { Sincronizador } from '@/ui/sistema/Sincronizador'

const instrument = Instrument_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Libreta',
  description: 'Tu almacén, en tu celu',
}

export const viewport: Viewport = {
  themeColor: '#12694E',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-tema="claro">
      <body className={instrument.className}>
        <RegistrarSW />
        <Sincronizador />
        <main className="pb-20">{children}</main>
        <Navegacion />
      </body>
    </html>
  )
}
