import { describe, it, expect } from 'vitest'
import { gananciaRealDelMes } from '@/dominio/gananciaReal'
import type { MovimientoCaja, Venta } from '@/dominio/tipos'

const AHORA = new Date('2026-11-15T12:00:00').getTime()

function venta(parcial: Partial<Venta>): Venta {
  return {
    id: 'v1', fecha: new Date('2026-11-10T14:00:00').getTime(),
    total: 1000000, medioPago: 'efectivo', clienteId: null,
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 1000000, costo: 700000 }],
    ...parcial,
  }
}

function salida(monto: number, concepto: string, fecha = new Date('2026-11-05').getTime()): MovimientoCaja {
  return { id: concepto, fecha, tipo: 'salida', monto, concepto } as MovimientoCaja
}

describe('gananciaRealDelMes', () => {
  it('resta los gastos de caja y los fijos a lo que dejaron las ventas', () => {
    const r = gananciaRealDelMes([venta({})], [salida(50000, 'Bolsas')], [{ monto: 100000 }], AHORA)
    expect(r.gananciaBruta).toBe(300000)
    expect(r.gastosCaja).toBe(50000)
    expect(r.gastosFijos).toBe(100000)
    expect(r.queda).toBe(150000)
    expect(r.margen).toBeCloseTo(0.3)
  })

  it('no cuenta ventas anuladas, de otro mes ni devoluciones', () => {
    const r = gananciaRealDelMes(
      [venta({ estado: 'anulada' }), venta({ id: 'v2', fecha: new Date('2026-10-30').getTime() })],
      [salida(5000, 'Devolución de venta'), salida(7000, 'Viejo', new Date('2026-10-02').getTime())],
      [],
      AHORA,
    )
    expect(r.vendido).toBe(0)
    expect(r.gastosCaja).toBe(0)
    expect(r.equilibrioDiario).toBeNull()
  })

  it('calcula cuánto vender por día para cubrir los gastos fijos', () => {
    // margen 30%, fijos $9.000 en 30 días → $1.000 de ganancia por día → $3.333 de venta
    const r = gananciaRealDelMes([venta({})], [], [{ monto: 900000 }], AHORA)
    expect(r.diasDelMes).toBe(30)
    expect(r.equilibrioDiario).toBe(100000)
    expect(r.queda).toBe(-600000)
  })
})
