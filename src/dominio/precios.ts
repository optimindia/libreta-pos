import type { Centavos, Producto, UUID } from './tipos'

/** Redondeo de precios de venta: ningún precio de almacén termina en $3.847.
 *  En centavos, $10 son 1000. */
export const PASO_REDONDEO = 1000

export function redondearPrecio(centavos: Centavos, paso: number = PASO_REDONDEO): Centavos {
  if (paso <= 1) return centavos
  return Math.ceil(centavos / paso) * paso
}

/** Sube o baja un precio por porcentaje y lo redondea. */
export function ajustarPorcentaje(precio: Centavos, porcentaje: number): Centavos {
  return redondearPrecio(Math.round(precio * (1 + porcentaje / 100)))
}

/** Precio de venta desde el costo con un margen: costo * (1 + margen / 100). */
export function precioConMargen(costo: Centavos, margen: number): Centavos {
  return redondearPrecio(Math.round(costo * (1 + margen / 100)))
}

export interface CambioPrecio {
  producto: Producto
  precioActual: Centavos
  precioNuevo: Centavos
}

/** Todos los precios que cambiarían. Los desmarcados y los que quedan
 *  igual no aparecen: la lista que se ve es la lista que se aplica. */
export function cambiosPorPorcentaje(
  productos: Producto[],
  porcentaje: number,
  desmarcados: ReadonlySet<UUID> = new Set(),
): CambioPrecio[] {
  return productos
    .filter((producto) => !desmarcados.has(producto.id))
    .map((producto) => ({
      producto,
      precioActual: producto.precio,
      precioNuevo: ajustarPorcentaje(producto.precio, porcentaje),
    }))
    .filter((cambio) => cambio.precioNuevo !== cambio.precioActual)
}

/** Recalcula el precio de venta desde el costo que vino en la factura.
 *  Sin costo cargado no se inventa precio. */
export function cambiosPorMargen(
  productos: Producto[],
  margen: number,
  desmarcados: ReadonlySet<UUID> = new Set(),
): CambioPrecio[] {
  return productos
    .filter((producto) => !desmarcados.has(producto.id) && producto.costo > 0)
    .map((producto) => ({
      producto,
      precioActual: producto.precio,
      precioNuevo: precioConMargen(producto.costo, margen),
    }))
    .filter((cambio) => cambio.precioNuevo !== cambio.precioActual)
}