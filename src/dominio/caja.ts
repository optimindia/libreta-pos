import type { Centavos, FiadoPago, MovimientoCaja, Venta } from './tipos'
import { sumar } from './dinero'

export interface MovimientosEfectivo {
  ventasEfectivo: Centavos
  pagosFiadoEfectivo: Centavos
  entradasCaja?: Centavos
  salidasCaja?: Centavos
}

/** Lo que entró al cajón desde el último cierre. Los pagos de fiado se
 *  cuentan como efectivo: en el mostrador se cobran en efectivo. */
export function movimientosEfectivo(
  ventas: Venta[],
  pagos: FiadoPago[],
  desde: number,
  hasta: number,
  movimientosCaja: MovimientoCaja[] = [],
): MovimientosEfectivo {
  const enElPeriodo = (fecha: number) => fecha > desde && fecha <= hasta
  const manuales = movimientosCaja.filter((movimiento) =>
    movimiento.medioPago === 'efectivo' && enElPeriodo(movimiento.fecha),
  )
  return {
    ventasEfectivo: sumar(
      ...ventas
        .filter((venta) => venta.estado !== 'anulada' && venta.medioPago === 'efectivo' && enElPeriodo(venta.fecha))
        .map((venta) => venta.total),
    ),
    pagosFiadoEfectivo: sumar(
      ...pagos.filter((pago) => enElPeriodo(pago.fecha)).map((pago) => pago.monto),
    ),
    entradasCaja: sumar(...manuales.filter((m) => m.tipo === 'entrada').map((m) => m.monto)),
    salidasCaja: sumar(...manuales.filter((m) => m.tipo === 'salida').map((m) => m.monto)),
  }
}

/** Lo que debería haber en el cajón al momento de cerrar. */
export function esperadoEnCaja(
  fondoInicial: Centavos,
  movimientos: MovimientosEfectivo,
): Centavos {
  return sumar(
    fondoInicial,
    movimientos.ventasEfectivo,
    movimientos.pagosFiadoEfectivo,
    movimientos.entradasCaja ?? 0,
    -(movimientos.salidasCaja ?? 0),
  )
}

/** Positivo si sobró, negativo si faltó, cero si cuadró. */
export function diferenciaCaja(contado: Centavos, esperado: Centavos): Centavos {
  return contado - esperado
}
