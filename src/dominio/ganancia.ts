import type { Centavos, MedioPago, UUID, Venta } from './tipos'
import { multiplicar, sumar } from './dinero'

export interface ResumenDia {
  vendido: Centavos
  ganancia: Centavos
  cantidadVentas: number
  porMedioPago: Record<MedioPago, Centavos>
}

export function gananciaVenta(venta: Venta): Centavos {
  return sumar(
    ...venta.items.map((item) =>
      multiplicar(item.precio - item.costo, item.cantidad),
    ),
  )
}

function esMismoDia(fecha: number, dia: Date): boolean {
  const f = new Date(fecha)
  return (
    f.getFullYear() === dia.getFullYear() &&
    f.getMonth() === dia.getMonth() &&
    f.getDate() === dia.getDate()
  )
}

export interface ProductoVendido {
  productoId: UUID
  nombre: string
  unidades: number
}

/** Los productos del día ordenados de más a menos vendidos: la lista que
 *  responde "¿qué se movió hoy?" de un vistazo, sin ir a buscarlo en el ticket. */
export function masVendidos(ventas: Venta[], dia: Date, limite: number = 3): ProductoVendido[] {
  const delDia = ventas.filter((venta) => esMismoDia(venta.fecha, dia))
  const porProducto = new Map<UUID, ProductoVendido>()

  for (const venta of delDia) {
    for (const item of venta.items) {
      const existente = porProducto.get(item.productoId)
      if (existente) existente.unidades += item.cantidad
      else porProducto.set(item.productoId, { productoId: item.productoId, nombre: item.nombre, unidades: item.cantidad })
    }
  }

  return [...porProducto.values()]
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limite)
}

export function resumenDelDia(ventas: Venta[], dia: Date): ResumenDia {
  const delDia = ventas.filter((venta) => esMismoDia(venta.fecha, dia))
  const porMedioPago: Record<MedioPago, Centavos> = {
    efectivo: 0, transferencia: 0, qr: 0, fiado: 0,
  }
  for (const venta of delDia) {
    porMedioPago[venta.medioPago] += venta.total
  }
  return {
    vendido: sumar(...delDia.map((venta) => venta.total)),
    ganancia: sumar(...delDia.map(gananciaVenta)),
    cantidadVentas: delDia.length,
    porMedioPago,
  }
}
