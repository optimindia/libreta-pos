import type { Centavos, MovimientoCaja, Venta } from './tipos'
import { gananciaVenta } from './ganancia'

export interface GananciaReal {
  /** "noviembre" */
  mes: string
  vendido: Centavos
  /** Lo que dejaron las ventas: precio menos costo. */
  gananciaBruta: Centavos
  /** Las salidas de caja del mes (gastos sueltos), sin contar devoluciones. */
  gastosCaja: Centavos
  gastosFijos: Centavos
  /** Lo que de verdad queda. Puede ser negativo. */
  queda: Centavos
  /** Margen de lo vendido, 0 a 1. */
  margen: number
  /** Cuánto hay que vender por día para cubrir los gastos fijos, o null sin margen. */
  equilibrioDiario: Centavos | null
  diasDelMes: number
  diaDelMes: number
}

const NOMBRE_MES = new Intl.DateTimeFormat('es-AR', { month: 'long' })

/** Ganancia real del mes en curso: lo que dejan las ventas menos los gastos
 *  sueltos de caja y los gastos fijos (alquiler, luz, sueldos…). */
export function gananciaRealDelMes(
  ventas: Venta[],
  movimientos: MovimientoCaja[],
  gastosFijos: Array<{ monto: Centavos }>,
  ahora: number,
): GananciaReal {
  const fecha = new Date(ahora)
  const desde = new Date(fecha.getFullYear(), fecha.getMonth(), 1).getTime()
  const hasta = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1).getTime()
  const diasDelMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
  const delMes = ventas.filter((venta) => venta.estado !== 'anulada' && venta.fecha >= desde && venta.fecha < hasta)
  const vendido = delMes.reduce((total, venta) => total + venta.total, 0)
  const gananciaBruta = delMes.reduce((total, venta) => total + gananciaVenta(venta), 0)
  const gastosCaja = movimientos
    .filter((m) => m.tipo === 'salida' && m.fecha >= desde && m.fecha < hasta && !m.concepto.startsWith('Devolución'))
    .reduce((total, m) => total + m.monto, 0)
  const fijos = gastosFijos.reduce((total, g) => total + g.monto, 0)
  const margen = vendido > 0 ? gananciaBruta / vendido : 0
  return {
    mes: NOMBRE_MES.format(fecha),
    vendido,
    gananciaBruta,
    gastosCaja,
    gastosFijos: fijos,
    queda: gananciaBruta - gastosCaja - fijos,
    margen,
    equilibrioDiario: margen > 0 && fijos > 0 ? Math.ceil(fijos / margen / diasDelMes / 100 - 1e-9) * 100 : null,
    diasDelMes,
    diaDelMes: fecha.getDate(),
  }
}
