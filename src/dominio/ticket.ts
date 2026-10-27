import type { ItemVenta, Producto, Centavos, UUID } from './tipos'
import { multiplicar, sumar } from './dinero'

/** Precio que se usa en una venta nueva. Las ofertas son temporales y sólo
 * afectan a tickets creados mientras siguen vigentes. */
export function precioVigente(producto: Producto, ahora: number = Date.now()): Centavos {
  const tieneFechaValida = producto.ofertaHasta === undefined || producto.ofertaHasta >= ahora
  if (producto.precioOferta && producto.precioOferta > 0 && producto.precioOferta < producto.precio && tieneFechaValida) {
    return producto.precioOferta
  }
  return producto.precio
}

export function tieneOfertaVigente(producto: Producto, ahora: number = Date.now()): boolean {
  return precioVigente(producto, ahora) !== producto.precio
}

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
      precio: precioVigente(producto),
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
