import type { Centavos, ItemVenta, Producto, UUID } from './tipos'

export interface PrecioMayorista {
  precio: Centavos
  /** Desde cuántas unidades se aplica solo (sin esto, sólo en venta mayorista). */
  desde?: number
}

export type MapaMayorista = Record<UUID, PrecioMayorista>

export function mapaMayorista(productos: Array<Pick<Producto, 'id' | 'precioMayorista' | 'mayoristaDesde'>>): MapaMayorista {
  const mapa: MapaMayorista = {}
  for (const producto of productos) {
    if (typeof producto.precioMayorista === 'number' && producto.precioMayorista > 0) {
      mapa[producto.id] = {
        precio: producto.precioMayorista,
        ...(typeof producto.mayoristaDesde === 'number' && producto.mayoristaDesde > 0 ? { desde: producto.mayoristaDesde } : {}),
      }
    }
  }
  return mapa
}

/** Si al renglón le corresponde el precio mayorista: en una venta por mayor
 *  siempre, y si no, cuando lleva la cantidad mínima. Nunca sube un precio
 *  (si hay una oferta más barata, queda la oferta). */
export function precioConMayorista(item: ItemVenta, mapa: MapaMayorista, ventaMayorista: boolean): Centavos {
  const mayor = mapa[item.productoId]
  if (!mayor) return item.precio
  const corresponde = ventaMayorista || (mayor.desde !== undefined && item.cantidad >= mayor.desde)
  return corresponde ? Math.min(item.precio, mayor.precio) : item.precio
}

export function aplicarMayorista(items: ItemVenta[], mapa: MapaMayorista, ventaMayorista = false): ItemVenta[] {
  return items.map((item) => {
    const precio = precioConMayorista(item, mapa, ventaMayorista)
    return precio === item.precio ? item : { ...item, precio }
  })
}

/** Cuánto se ahorra el cliente por comprar por mayor en estos renglones. */
export function ahorroMayorista(items: ItemVenta[], mapa: MapaMayorista, ventaMayorista = false): Centavos {
  return items.reduce((total, item) => total + Math.round((item.precio - precioConMayorista(item, mapa, ventaMayorista)) * item.cantidad), 0)
}
