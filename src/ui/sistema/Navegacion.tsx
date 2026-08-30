'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { IconoVender, IconoFiados, IconoStock, IconoPlata } from './iconos'

const SECCIONES = [
  { href: '/', texto: 'Vender', Icono: IconoVender },
  { href: '/fiados', texto: 'Fiados', Icono: IconoFiados },
  { href: '/stock', texto: 'Stock', Icono: IconoStock },
  { href: '/plata', texto: 'Plata', Icono: IconoPlata },
]

export function Navegacion() {
  const ruta = usePathname()
  // Cuenta los que siguen debiendo, no todos los anotados alguna vez.
  const fiadosAbiertos = useLiveQuery(
    async () => (await repos.fiados.abiertos()).length,
    [],
    0,
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 flex pt-2 pb-3"
      style={{ background: 'var(--hueso)', borderTop: '1px solid var(--linea)' }}
    >
      {SECCIONES.map(({ href, texto, Icono }) => {
        const activa = ruta === href
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center gap-0.5"
            style={{ color: activa ? 'var(--verde)' : 'var(--tenue)' }}
          >
            <Icono />
            <span className={`text-[10px] ${activa ? 'font-bold' : ''}`}>{texto}</span>
            {href === '/fiados' && fiadosAbiertos > 0 && (
              <span
                className="tabular absolute -top-1 right-5 rounded-full px-1.5 text-[9px] font-bold"
                style={{ background: 'var(--ambar)', color: 'var(--hueso)' }}
              >
                {fiadosAbiertos}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
