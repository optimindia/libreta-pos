import type { Centavos, FiadoPago, MedioPago, MovimientoCaja, Venta } from './tipos'
import { gananciaVenta } from './ganancia'
import { montoEnMedio } from './pagos'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const

export interface ResumenMensual {
  /** "noviembre de 2026" */
  titulo: string
  vendido: Centavos
  cantidadVentas: number
  ticketPromedio: Centavos
  ganancia: Centavos
  margen: number
  gastosCaja: Centavos
  gastosFijos: Centavos
  queda: Centavos
  cobradoDeFiados: Centavos
  porMedio: Record<MedioPago, Centavos>
  porDia: Array<{ dia: number; monto: Centavos }>
  mejorDia: { dia: number; monto: Centavos } | null
  masVendidos: Array<{ nombre: string; cantidad: number; monto: Centavos }>
  anulaciones: number
  /** Contra el mes anterior, en %, o null si el anterior no tuvo ventas. */
  contraMesAnterior: number | null
}

/** Todo el mes en un vistazo: para imprimir o guardar como PDF. `mes` va
 *  de 0 (enero) a 11. */
export function resumenMensual(
  ventas: Venta[],
  movimientos: MovimientoCaja[],
  pagosFiado: FiadoPago[],
  gastosFijos: Array<{ monto: Centavos }>,
  anio: number,
  mes: number,
): ResumenMensual {
  const desde = new Date(anio, mes, 1).getTime()
  const hasta = new Date(anio, mes + 1, 1).getTime()
  const diasDelMes = new Date(anio, mes + 1, 0).getDate()
  const delMes = ventas.filter((venta) => venta.fecha >= desde && venta.fecha < hasta)
  const validas = delMes.filter((venta) => venta.estado !== 'anulada')
  const vendido = validas.reduce((total, venta) => total + venta.total, 0)
  const ganancia = validas.reduce((total, venta) => total + gananciaVenta(venta), 0)
  const gastosCaja = movimientos
    .filter((m) => m.tipo === 'salida' && m.fecha >= desde && m.fecha < hasta && !m.concepto.startsWith('Devolución'))
    .reduce((total, m) => total + m.monto, 0)
  const fijos = gastosFijos.reduce((total, gasto) => total + gasto.monto, 0)

  const porMedio: Record<MedioPago, Centavos> = { efectivo: 0, transferencia: 0, qr: 0, fiado: 0 }
  for (const venta of validas) for (const medio of Object.keys(porMedio) as MedioPago[]) porMedio[medio] += montoEnMedio(venta, medio)

  const porDia = Array.from({ length: diasDelMes }, (_, i) => ({ dia: i + 1, monto: 0 }))
  for (const venta of validas) porDia[new Date(venta.fecha).getDate() - 1].monto += venta.total
  const mejor = porDia.reduce<{ dia: number; monto: Centavos } | null>((max, dia) => (dia.monto > (max?.monto ?? 0) ? dia : max), null)

  const productos = new Map<string, { nombre: string; cantidad: number; monto: Centavos }>()
  for (const venta of validas) {
    for (const item of venta.items) {
      const actual = productos.get(item.productoId) ?? { nombre: item.nombre, cantidad: 0, monto: 0 }
      actual.cantidad += item.cantidad
      actual.monto += Math.round(item.precio * item.cantidad)
      productos.set(item.productoId, actual)
    }
  }

  const desdeAnterior = new Date(anio, mes - 1, 1).getTime()
  const vendidoAnterior = ventas
    .filter((venta) => venta.estado !== 'anulada' && venta.fecha >= desdeAnterior && venta.fecha < desde)
    .reduce((total, venta) => total + venta.total, 0)

  return {
    titulo: `${MESES[mes]} de ${anio}`,
    vendido,
    cantidadVentas: validas.length,
    ticketPromedio: validas.length ? Math.round(vendido / validas.length / 100) * 100 : 0,
    ganancia,
    margen: vendido > 0 ? Math.round((ganancia / vendido) * 100) : 0,
    gastosCaja,
    gastosFijos: fijos,
    queda: ganancia - gastosCaja - fijos,
    cobradoDeFiados: pagosFiado.filter((pago) => pago.fecha >= desde && pago.fecha < hasta).reduce((total, pago) => total + pago.monto, 0),
    porMedio,
    porDia,
    mejorDia: mejor,
    masVendidos: [...productos.values()].sort((a, b) => b.monto - a.monto).slice(0, 10),
    anulaciones: delMes.length - validas.length,
    contraMesAnterior: vendidoAnterior > 0 ? Math.round((vendido / vendidoAnterior - 1) * 100) : null,
  }
}

/** Los meses que se pueden elegir: del actual hacia atrás, hasta el de la
 *  primera venta (como mucho 24). */
export function mesesDisponibles(ventas: Venta[], ahora: number): Array<{ anio: number; mes: number; titulo: string }> {
  const hoy = new Date(ahora)
  const primera = ventas.length ? new Date(Math.min(...ventas.map((venta) => venta.fecha))) : hoy
  const salida: Array<{ anio: number; mes: number; titulo: string }> = []
  for (let i = 0; i < 24; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    salida.push({ anio: fecha.getFullYear(), mes: fecha.getMonth(), titulo: `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}` })
    if (fecha.getFullYear() === primera.getFullYear() && fecha.getMonth() === primera.getMonth()) break
    if (fecha < primera) break
  }
  return salida
}
