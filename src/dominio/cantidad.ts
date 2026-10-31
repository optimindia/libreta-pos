import type { Centavos, ItemVenta, Producto, UnidadVenta } from './tipos'

/** Las cantidades fraccionadas se guardan con hasta tres decimales: un gramo
 *  o un mililitro. */
export const DECIMALES = 3

export function unidadDe(producto: Pick<Producto, 'unidad'>): UnidadVenta {
  return producto.unidad ?? 'unidad'
}

/** ¿Se vende por kilo o por litro (con decimales)? */
export function esFraccionado(producto: Pick<Producto, 'unidad'>): boolean {
  return unidadDe(producto) !== 'unidad'
}

export function redondearCantidad(cantidad: number): number {
  return Math.round(cantidad * 10 ** DECIMALES) / 10 ** DECIMALES
}

/** Una cantidad que se puede vender o mover: positiva y de a gramo/mililitro. */
export function cantidadValida(cantidad: number): boolean {
  return Number.isFinite(cantidad) && cantidad > 0 && redondearCantidad(cantidad) === cantidad
}

const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: DECIMALES })

/** "3", "526 g", "1,25 kg", "500 ml", "1,5 L". */
export function formatearCantidad(cantidad: number, unidad: UnidadVenta = 'unidad'): string {
  if (unidad === 'unidad') return NUMERO.format(cantidad)
  const chica = unidad === 'kg' ? 'g' : 'ml'
  const grande = unidad === 'kg' ? 'kg' : 'L'
  if (Math.abs(cantidad) < 1) return `${Math.round(cantidad * 1000)} ${chica}`
  return `${NUMERO.format(redondearCantidad(cantidad))} ${grande}`
}

/** "el kilo", "el litro", "c/u": para acompañar un precio. */
export function porUnidad(unidad: UnidadVenta = 'unidad'): string {
  return unidad === 'kg' ? 'el kilo' : unidad === 'l' ? 'el litro' : 'c/u'
}

/** Cuánto cuesta una cantidad a un precio por kilo o litro. */
export function importePorCantidad(precio: Centavos, cantidad: number): Centavos {
  return Math.round(precio * cantidad)
}

/** "Dame $500": la cantidad que corresponde a esa plata y un precio por
 *  unidad que hace que el renglón dé exactamente ese importe. El precio se
 *  aparta de lista sólo en centavos (lo justo para no cobrar de más ni de
 *  menos). Devuelve null si no alcanza ni para un gramo. */
export function porMonto(precio: Centavos, monto: Centavos): { cantidad: number; precio: Centavos } | null {
  if (!(precio > 0) || !(monto > 0)) return null
  const base = redondearCantidad(monto / precio)
  if (base <= 0) return null
  let mejor: { cantidad: number; precio: Centavos; error: number } | null = null
  // Se prueba la cantidad y sus vecinas (±10 g) hasta dar con un importe exacto.
  for (let paso = 0; paso <= 10; paso += 1) {
    for (const signo of paso === 0 ? [0] : [-1, 1]) {
      const cantidad = redondearCantidad(base + signo * paso / 10 ** DECIMALES)
      if (cantidad <= 0) continue
      const ajustado = Math.round(monto / cantidad)
      const error = Math.abs(importePorCantidad(ajustado, cantidad) - monto)
      if (error === 0) return { cantidad, precio: ajustado }
      if (!mejor || error < mejor.error) mejor = { cantidad, precio: ajustado, error }
    }
  }
  return mejor && { cantidad: mejor.cantidad, precio: mejor.precio }
}

/** Convierte lo que se escribe ("0,5", "1.25", "500") a número. */
export function leerCantidad(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (limpio === '' || !/^\d*\.?\d*$/.test(limpio)) return Number.NaN
  return Number(limpio)
}

/** Pone (o reemplaza) el renglón de un producto por kilo o litro con la
 *  cantidad y el precio por unidad elegidos. */
export function ponerFraccion(
  items: ItemVenta[],
  producto: Pick<Producto, 'id' | 'nombre' | 'costo'>,
  cantidad: number,
  precio: Centavos,
): ItemVenta[] {
  const renglon: ItemVenta = { productoId: producto.id, nombre: producto.nombre, cantidad: redondearCantidad(cantidad), precio, costo: producto.costo }
  return items.some((item) => item.productoId === producto.id)
    ? items.map((item) => (item.productoId === producto.id ? renglon : item))
    : [...items, renglon]
}
