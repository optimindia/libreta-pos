'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { UUID } from '@/dominio/tipos'
import type { VentaAbierta } from '@/dominio/ventaAbierta'
import { escucharReservas, publicarReservas, reservasDeOtros, type Reservas } from '@/datos/nube/reservasEnVivo'

const NADA: Reservas = new Map()

/** Avisa a los otros aparatos lo que llevan las ventas abiertas de éste y
 *  devuelve lo que tienen apartado ellos, para no vender dos veces lo mismo. */
export function useReservasEnVivo(ventas: VentaAbierta[] | undefined): Reservas {
  const firma = JSON.stringify(totales(ventas ?? []))
  useEffect(() => {
    publicarReservas(JSON.parse(firma) as Record<UUID, number>)
  }, [firma])
  return useSyncExternalStore(escucharReservas, reservasDeOtros, () => NADA)
}

function totales(ventas: VentaAbierta[]): Record<UUID, number> {
  const suma: Record<UUID, number> = {}
  for (const venta of ventas) {
    for (const renglon of venta.items) {
      if (renglon.cantidad > 0) suma[renglon.productoId] = (suma[renglon.productoId] ?? 0) + renglon.cantidad
    }
  }
  return suma
}
