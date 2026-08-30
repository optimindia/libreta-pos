import { describe, it, expect } from 'vitest'
import {
  diferenciaCaja,
  esperadoEnCaja,
  movimientosEfectivo,
} from '@/dominio/caja'
import type { FiadoPago, Venta } from '@/dominio/tipos'

function venta(parcial: Partial<Venta> & Pick<Venta, 'id' | 'total' | 'medioPago'>): Venta {
  return { fecha: Date.now(), items: [], clienteId: null, ...parcial }
}

function pago(monto: number, fecha: number): FiadoPago {
  return { id: `${monto}-${fecha}`, fiadoId: 'f1', monto, fecha }
}

describe('movimientosEfectivo', () => {
  it('sólo cuenta las ventas en efectivo dentro del período', () => {
    const desde = 1000
    const hasta = 5000
    const ventas = [
      venta({ id: 'a', total: 100000, medioPago: 'efectivo', fecha: 2000 }),
      venta({ id: 'b', total: 50000, medioPago: 'efectivo', fecha: 6000 }),   // después del cierre
      venta({ id: 'c', total: 70000, medioPago: 'efectivo', fecha: 500 }),    // antes del último cierre
      venta({ id: 'd', total: 80000, medioPago: 'transferencia', fecha: 2000 }),
      venta({ id: 'e', total: 90000, medioPago: 'fiado', fecha: 2000 }),
    ]
    expect(movimientosEfectivo(ventas, [], desde, hasta).ventasEfectivo).toBe(100000)
  })

  it('cuenta los pagos de fiado del período como efectivo', () => {
    const desde = 1000
    const hasta = 5000
    const pagos = [pago(30000, 2000), pago(20000, 6000), pago(10000, 500)]
    expect(movimientosEfectivo([], pagos, desde, hasta).pagosFiadoEfectivo).toBe(30000)
  })
})

describe('esperadoEnCaja', () => {
  it('suma el fondo inicial, las ventas en efectivo y los pagos de fiado', () => {
    expect(
      esperadoEnCaja(50000, { ventasEfectivo: 420000, pagosFiadoEfectivo: 30000 }),
    ).toBe(500000)
  })
})

describe('diferenciaCaja', () => {
  it('cuadra cuando se cuenta lo esperado', () => {
    expect(diferenciaCaja(500000, 500000)).toBe(0)
  })

  it('negativa cuando falta plata', () => {
    expect(diferenciaCaja(498000, 500000)).toBe(-2000)
  })

  it('positiva cuando sobra', () => {
    expect(diferenciaCaja(502000, 500000)).toBe(2000)
  })
})