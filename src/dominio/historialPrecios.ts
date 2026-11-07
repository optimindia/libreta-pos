import type { CambioPrecio, Centavos, Producto } from './tipos'

/** Cuántos cambios se guardan por producto: alcanza para ver cómo vino
 *  subiendo sin que la ficha crezca sin fin. */
export const MAXIMO_CAMBIOS = 24

/** El historial del producto después de guardarlo. Si el precio o el costo
 *  cambiaron, suma una entrada; si es el primer cambio, también guarda cómo
 *  estaba antes, así se ve desde dónde subió. Sin cambios, queda igual. */
export function historialConCambio(anterior: Producto | undefined, nuevo: Pick<Producto, 'precio' | 'costo' | 'historialPrecios'>, ahora: number): CambioPrecio[] | undefined {
  const previo = nuevo.historialPrecios ?? anterior?.historialPrecios
  if (!anterior) return previo
  if (anterior.precio === nuevo.precio && anterior.costo === nuevo.costo) return previo
  const base: CambioPrecio[] = previo && previo.length > 0
    ? [...previo]
    : [{ fecha: anterior.actualizadoEn ?? ahora, precio: anterior.precio, costo: anterior.costo }]
  base.push({ fecha: ahora, precio: nuevo.precio, costo: nuevo.costo })
  return base.slice(-MAXIMO_CAMBIOS)
}

/** Sólo entradas sanas (lo que baja de la nube puede venir de otra versión). */
export function historialValido(historial: unknown): CambioPrecio[] {
  if (!Array.isArray(historial)) return []
  return historial.filter((cambio): cambio is CambioPrecio =>
    !!cambio && typeof cambio === 'object'
    && Number.isFinite((cambio as CambioPrecio).fecha)
    && Number.isFinite((cambio as CambioPrecio).precio)
    && Number.isFinite((cambio as CambioPrecio).costo))
}

/** Cuánto cambió el precio en porcentaje entre dos valores (null si no se puede). */
export function variacion(desde: Centavos, hasta: Centavos): number | null {
  if (desde <= 0) return null
  return Math.round((hasta / desde - 1) * 1000) / 10
}

export interface ResumenHistorial {
  cambios: CambioPrecio[]
  /** Variación del precio desde la primera entrada guardada. */
  subioDesdeElPrimero: number | null
  primero: CambioPrecio | null
}

export function resumenHistorial(producto: Pick<Producto, 'historialPrecios' | 'precio'>): ResumenHistorial {
  const cambios = historialValido(producto.historialPrecios)
  const primero = cambios[0] ?? null
  return {
    cambios,
    primero,
    subioDesdeElPrimero: primero ? variacion(primero.precio, producto.precio) : null,
  }
}
