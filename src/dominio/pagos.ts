import type { Centavos, MedioPago, Venta } from './tipos'
import { formatearPesos } from './dinero'

/** Una parte del pago de una venta: "$5.000 en efectivo". */
export interface PartePago {
  medio: MedioPago
  monto: Centavos
}

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'QR',
  fiado: 'Fiado',
}

/** Cómo se pagó una venta, siempre como lista de partes: una venta de un
 *  solo medio es una parte con el total. */
export function partesDePago(venta: Pick<Venta, 'medioPago' | 'total' | 'pagos'>): PartePago[] {
  return venta.pagos && venta.pagos.length > 0 ? venta.pagos : [{ medio: venta.medioPago, monto: venta.total }]
}

/** Cuánto de la venta entró por un medio (para la caja, los reportes…). */
export function montoEnMedio(venta: Pick<Venta, 'medioPago' | 'total' | 'pagos'>, medio: MedioPago): Centavos {
  return partesDePago(venta).filter((parte) => parte.medio === medio).reduce((total, parte) => total + parte.monto, 0)
}

export function esPagoDividido(venta: Pick<Venta, 'pagos'>): boolean {
  return (venta.pagos?.length ?? 0) > 1
}

/** El medio de la parte más grande: es el que se muestra como "el" medio y
 *  el que usan los filtros que no saben de pagos divididos. */
export function medioPrincipal(pagos: PartePago[]): MedioPago {
  return [...pagos].sort((a, b) => b.monto - a.monto)[0].medio
}

/** null si está bien; si no, el motivo en palabras. */
export function problemaDePagos(pagos: PartePago[], total: Centavos): string | null {
  if (pagos.length < 2) return 'Un pago dividido tiene al menos dos partes.'
  if (pagos.some((parte) => !Number.isInteger(parte.monto) || parte.monto <= 0)) return 'Cada parte tiene que ser mayor a cero.'
  if (new Set(pagos.map((parte) => parte.medio)).size !== pagos.length) return 'Elegí un medio distinto para cada parte.'
  const suma = pagos.reduce((acumulado, parte) => acumulado + parte.monto, 0)
  if (suma !== total) return `Las partes suman ${formatearPesos(suma)} y la venta es de ${formatearPesos(total)}.`
  return null
}

/** "Efectivo $5.000 + Transferencia $3.000", o sólo "Efectivo". */
export function textoDePago(venta: Pick<Venta, 'medioPago' | 'total' | 'pagos'>): string {
  if (!esPagoDividido(venta)) return NOMBRE_MEDIO[venta.medioPago]
  return partesDePago(venta).map((parte) => `${NOMBRE_MEDIO[parte.medio]} ${formatearPesos(parte.monto)}`).join(' + ')
}
