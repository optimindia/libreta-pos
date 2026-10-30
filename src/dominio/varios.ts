import type { Centavos, ItemVenta, Producto } from './tipos'

/** "Varios": lo que se cobra sin estar cargado (fiambre al peso, una
 *  changa). En la nube cada renglón de venta tiene que ser de un producto,
 *  así que existe un producto interno con este código, oculto en el
 *  catálogo y en el stock, con existencias de sobra. */
export const CODIGO_VARIOS = 'LIBRETA-VARIOS'
export const NOMBRE_VARIOS = 'Varios'
export const STOCK_VARIOS = 1_000_000
/** Por debajo de esto se repone solo, para que nunca falte. */
export const MINIMO_VARIOS = 100_000

export function esProductoVarios(producto: Pick<Producto, 'codigoBarras'>): boolean {
  return producto.codigoBarras === CODIGO_VARIOS
}

/** Suma un monto libre al ticket. Todo lo de "Varios" va en un solo
 *  renglón: cada monto nuevo se agrega al anterior. */
export function sumarMontoLibre(items: ItemVenta[], varios: Producto, monto: Centavos): ItemVenta[] {
  const entero = Math.round(monto)
  if (!Number.isFinite(entero) || entero <= 0) return items
  const existente = items.find((item) => item.productoId === varios.id)
  if (existente) {
    return items.map((item) => (item.productoId === varios.id
      ? { ...item, precio: item.precio * item.cantidad + entero, cantidad: 1 }
      : item))
  }
  return [...items, { productoId: varios.id, nombre: NOMBRE_VARIOS, cantidad: 1, precio: entero, costo: 0 }]
}
