import type { Centavos, MedioPago, Producto, UUID, Venta } from './tipos'
import { multiplicar, sumar } from './dinero'
import { gananciaVenta } from './ganancia'

export type PeriodoReporte = 'hoy' | '7dias' | '30dias' | 'todo'

export interface RangoReporte {
  desde: number
  hasta: number
}

export interface ResumenPeriodo {
  vendido: Centavos
  ganancia: Centavos
  cantidadVentas: number
  unidades: number
  ticketPromedio: Centavos
  porMedioPago: Record<MedioPago, Centavos>
  porcentajePorMedio: Record<MedioPago, number>
}

export interface ProductoRanking {
  productoId: UUID
  nombre: string
  unidades: number
  vendido: Centavos
  ganancia: Centavos
}

function inicioDelDia(fecha: Date): number {
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  return inicio.getTime()
}

/** Devuelve períodos de calendario local, para que "hoy" coincida con el
 * día que ve el almacenero y no con la medianoche UTC del servidor. */
export function rangoReporte(periodo: PeriodoReporte, ahora: number = Date.now()): RangoReporte {
  const hasta = ahora
  if (periodo === 'todo') return { desde: 0, hasta }

  const dias = periodo === 'hoy' ? 0 : periodo === '7dias' ? 6 : 29
  const desde = new Date(inicioDelDia(new Date(ahora)))
  desde.setDate(desde.getDate() - dias)
  return { desde: desde.getTime(), hasta }
}

export function filtrarVentas(ventas: Venta[], rango: RangoReporte, incluirAnuladas = false): Venta[] {
  return ventas.filter((venta) =>
    (incluirAnuladas || venta.estado !== 'anulada') &&
    venta.fecha >= rango.desde && venta.fecha <= rango.hasta,
  )
}

export function resumenPeriodo(ventas: Venta[], periodo: PeriodoReporte, ahora: number = Date.now()): ResumenPeriodo {
  const delPeriodo = filtrarVentas(ventas, rangoReporte(periodo, ahora))
  const porMedioPago: Record<MedioPago, Centavos> = {
    efectivo: 0, transferencia: 0, qr: 0, fiado: 0,
  }
  let unidades = 0

  for (const venta of delPeriodo) {
    porMedioPago[venta.medioPago] += venta.total
    unidades += venta.items.reduce((total, item) => total + item.cantidad, 0)
  }

  const vendido = sumar(...delPeriodo.map((venta) => venta.total))
  const porcentajePorMedio = Object.fromEntries(
    Object.entries(porMedioPago).map(([medio, monto]) => [medio, vendido > 0 ? Math.round((monto / vendido) * 100) : 0]),
  ) as Record<MedioPago, number>

  return {
    vendido,
    ganancia: sumar(...delPeriodo.map(gananciaVenta)),
    cantidadVentas: delPeriodo.length,
    unidades,
    ticketPromedio: delPeriodo.length === 0 ? 0 : Math.round(vendido / delPeriodo.length),
    porMedioPago,
    porcentajePorMedio,
  }
}

/** Ranking accionable: no sólo qué se vendió, sino cuánto dejó cada
 * producto. Sirve para decidir qué reponer y qué precio revisar. */
export function rankingProductos(
  ventas: Venta[],
  periodo: PeriodoReporte,
  ahora: number = Date.now(),
): ProductoRanking[] {
  const ranking = new Map<UUID, ProductoRanking>()
  for (const venta of filtrarVentas(ventas, rangoReporte(periodo, ahora))) {
    for (const item of venta.items) {
      const actual = ranking.get(item.productoId) ?? {
        productoId: item.productoId,
        nombre: item.nombre,
        unidades: 0,
        vendido: 0,
        ganancia: 0,
      }
      actual.unidades += item.cantidad
      actual.vendido += multiplicar(item.precio, item.cantidad)
      actual.ganancia += multiplicar(item.precio - item.costo, item.cantidad)
      ranking.set(item.productoId, actual)
    }
  }
  return [...ranking.values()].sort((a, b) => b.vendido - a.vendido)
}

export function valorStock(productos: Producto[]): { costo: Centavos; venta: Centavos; unidades: number } {
  return productos.reduce(
    (total, producto) => ({
      costo: total.costo + multiplicar(producto.costo, Math.max(0, producto.stock)),
      venta: total.venta + multiplicar(producto.precio, Math.max(0, producto.stock)),
      unidades: total.unidades + Math.max(0, producto.stock),
    }),
    { costo: 0, venta: 0, unidades: 0 },
  )
}

export function porcentajeMargen(vendido: Centavos, ganancia: Centavos): number {
  return vendido <= 0 ? 0 : Math.round((ganancia / vendido) * 100)
}

export function etiquetaPeriodo(periodo: PeriodoReporte): string {
  if (periodo === 'hoy') return 'Hoy'
  if (periodo === '7dias') return 'Últimos 7 días'
  if (periodo === '30dias') return 'Últimos 30 días'
  return 'Todo'
}
