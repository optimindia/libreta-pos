import type { ItemVenta, Producto, Centavos, UUID } from './tipos'
import { multiplicar, sumar } from './dinero'

export function agregarProducto(
  items: ItemVenta[],
  producto: Producto,
  cantidad = 1,
): ItemVenta[] {
  const existente = items.find((item) => item.productoId === producto.id)
  if (existente) {
    return items.map((item) =>
      item.productoId === producto.id
        ? { ...item, cantidad: item.cantidad + cantidad }
        : item,
    )
  }
  return [
    ...items,
    {
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad,
      precio: producto.precio,
      costo: producto.costo,
    },
  ]
}

export function cambiarCantidad(
  items: ItemVenta[],
  productoId: UUID,
  cantidad: number,
): ItemVenta[] {
  if (cantidad <= 0) {
    return items.filter((item) => item.productoId !== productoId)
  }
  return items.map((item) =>
    item.productoId === productoId ? { ...item, cantidad } : item,
  )
}

export function totalTicket(items: ItemVenta[]): Centavos {
  return sumar(...items.map((item) => multiplicar(item.precio, item.cantidad)))
}
