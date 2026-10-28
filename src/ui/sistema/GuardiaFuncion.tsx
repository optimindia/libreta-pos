'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { DEFINICIONES_FUNCION, funcionActiva, normalizarFunciones, type ClaveFuncion } from '@/dominio/funciones'
import { rolDe, rutaPermitida } from '@/dominio/roles'
import { IconoBloqueo, IconoConfig } from './iconos'

const RUTAS_PROTEGIDAS: readonly { prefijo: string; clave: ClaveFuncion }[] = [
  { prefijo: '/vender', clave: 'vender' },
  { prefijo: '/operacion', clave: 'controlPro' },
  { prefijo: '/historial', clave: 'historial' },
  { prefijo: '/clientes', clave: 'clientes' },
  { prefijo: '/pedidos', clave: 'pedidos' },
  { prefijo: '/fiados', clave: 'fiados' },
  { prefijo: '/stock', clave: 'stock' },
  { prefijo: '/plata', clave: 'plata' },
] as const

function claveParaRuta(ruta: string): ClaveFuncion | null {
  return RUTAS_PROTEGIDAS.find(({ prefijo }) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))?.clave ?? null
}

function tituloDeFuncion(clave: ClaveFuncion): string {
  return DEFINICIONES_FUNCION.find((definicion) => definicion.clave === clave)?.titulo ?? 'Esta función'
}

/** Protección de interfaz para rutas directas. La ocultación en la barra es
 * comodidad; esta guardia evita que un enlace guardado abra un módulo apagado. */
export function GuardiaFuncion({ children }: { children: ReactNode }) {
  const ruta = usePathname() ?? '/'
  const preferencias = useLiveQuery(() => db.preferencias.get('unico'), [], undefined)
  const funciones = normalizarFunciones(preferencias?.funciones)
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const clave = claveParaRuta(ruta)

  if (!rutaPermitida(rolDe(negocio?.rol), ruta)) {
    return (
      <section className="feature-disabled-page" aria-labelledby="feature-disabled-title">
        <div className="feature-disabled-icon" aria-hidden="true"><IconoBloqueo /></div>
        <span className="page-kicker">Sólo para el dueño</span>
        <h1 id="feature-disabled-title">Esta parte la ve el dueño</h1>
        <p>Con tu acceso de vendedor podés vender, anotar fiados y mirar el stock.</p>
        <Link href="/vender" className="feature-disabled-link">Ir a vender</Link>
      </section>
    )
  }

  if (!clave || funcionActiva(funciones, clave)) return children

  return (
    <section className="feature-disabled-page" aria-labelledby="feature-disabled-title">
      <div className="feature-disabled-icon" aria-hidden="true"><IconoBloqueo /></div>
      <span className="page-kicker">Función desactivada</span>
      <h1 id="feature-disabled-title">{tituloDeFuncion(clave)} está oculta</h1>
      <p>Este módulo está desactivado para tu negocio. Podés volver a habilitarlo cuando quieras desde Configuración.</p>
      <Link href="/config#funciones" className="feature-disabled-link">
        <IconoConfig />
        Configurar funciones
      </Link>
    </section>
  )
}
