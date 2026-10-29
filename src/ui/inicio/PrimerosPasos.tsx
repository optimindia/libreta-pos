'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { IconoFlechaDerecha } from '@/ui/sistema/iconos'

export interface PasoGuia {
  id: 'producto' | 'venta' | 'negocio'
  titulo: string
  detalle: string
  href: string
  enlace: string
  hecho: boolean
}

const CLAVE = 'libreta:guia-primeros-pasos:'

export function claveGuia(negocioId: string | undefined): string {
  return `${CLAVE}${negocioId ?? 'local'}`
}

const AVISO = 'libreta:guia-cambio'
const suscribir = (alCambiar: () => void) => {
  window.addEventListener(AVISO, alCambiar)
  window.addEventListener('storage', alCambiar)
  return () => {
    window.removeEventListener(AVISO, alCambiar)
    window.removeEventListener('storage', alCambiar)
  }
}

const sinAlmacen = new Set<string>()

function leerOculta(clave: string): boolean {
  if (sinAlmacen.has(clave)) return true
  try {
    return window.localStorage.getItem(clave) === '1'
  } catch {
    return false
  }
}

/** Los pasos que le tocan a cada rol. Se marcan solos con los datos reales. */
export function pasosDeLaGuia(datos: {
  esDueno: boolean
  productos: number
  ventas: number
  nombreConfigurado: boolean
}): PasoGuia[] {
  const pasos: PasoGuia[] = []
  if (datos.esDueno) {
    pasos.push({
      id: 'producto',
      titulo: 'Cargá tu primer producto',
      detalle: 'Uno a uno o importando una lista.',
      href: '/stock',
      enlace: 'Ir a stock',
      hecho: datos.productos > 0,
    })
  }
  pasos.push({
    id: 'venta',
    titulo: 'Hacé tu primera venta',
    detalle: 'Puede ser de prueba: sirve para ver cómo anda.',
    href: '/vender',
    enlace: 'Ir a vender',
    hecho: datos.ventas > 0,
  })
  if (datos.esDueno) {
    pasos.push({
      id: 'negocio',
      titulo: 'Poné el nombre de tu negocio',
      detalle: 'Aparece arriba de todo en la app.',
      href: '/config',
      enlace: 'Ir a ajustes',
      hecho: datos.nombreConfigurado,
    })
  }
  return pasos
}

/** Guía de primeros pasos: sólo se ve mientras falten pasos y no se la haya
 *  ocultado. No bloquea nada; "Ocultar guía" se acuerda por negocio. */
export function PrimerosPasos({ pasos, negocioId }: { pasos: PasoGuia[]; negocioId?: string }) {
  const clave = claveGuia(negocioId)
  // En el servidor (y al hidratar) se asume oculta: así no parpadea.
  const oculta = useSyncExternalStore(suscribir, () => leerOculta(clave), () => true)

  const hechos = pasos.filter((paso) => paso.hecho).length
  if (oculta || pasos.length === 0 || hechos === pasos.length) return null

  const ocultar = () => {
    try {
      window.localStorage.setItem(clave, '1')
    } catch {
      /* sin almacenamiento: se oculta igual hasta que se recargue */
      sinAlmacen.add(clave)
    }
    window.dispatchEvent(new Event(AVISO))
  }

  return (
    <section className="fi-guia" aria-label="Primeros pasos">
      <div className="fi-guia-cabeza">
        <h2 className="f-seccion">Primeros pasos</h2>
        <button type="button" className="fi-guia-ocultar" onClick={ocultar}>Ocultar guía</button>
      </div>
      <p className="f-dato fi-guia-conteo">{hechos} de {pasos.length} listos</p>
      <progress className="fi-guia-barra" max={pasos.length} value={hechos} aria-label="Progreso de los primeros pasos" />
      <ol className="fi-guia-lista">
        {pasos.map((paso) => (
          <li key={paso.id} className="fi-guia-paso" data-hecho={paso.hecho ? 'true' : undefined}>
            <span className="fi-guia-marca" aria-hidden="true">{paso.hecho ? '✓' : ''}</span>
            <span className="fi-guia-texto">
              <strong>{paso.titulo}{paso.hecho && <span className="fi-guia-oculto"> (listo)</span>}</strong>
              <small>{paso.detalle}</small>
            </span>
            {!paso.hecho && (
              <Link href={paso.href} className="fi-guia-enlace">{paso.enlace} <IconoFlechaDerecha /></Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
