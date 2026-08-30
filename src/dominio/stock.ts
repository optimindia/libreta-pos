import type { Ingreso, Producto, UUID, Venta } from './tipos'

export function stockCalculado(
  productoId: UUID,
  ingresos: Ingreso[],
  ventas: Venta[],
): number {
  let entraron = 0
  for (const ingreso of ingresos) {
    for (const item of ingreso.items) {
      if (item.productoId === productoId) entraron += item.cantidad
    }
  }

  let salieron = 0
  for (const venta of ventas) {
    for (const item of venta.items) {
      if (item.productoId === productoId) salieron += item.cantidad
    }
  }

  return entraron - salieron
}

export function faltantes(productos: Producto[]): Producto[] {
  return productos
    .filter((producto) => producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo)
    .sort((a, b) => a.stock - b.stock)
}
