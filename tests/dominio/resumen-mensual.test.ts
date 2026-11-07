import { describe, it, expect } from 'vitest'
import { mesesDisponibles, resumenMensual } from '@/dominio/resumenMensual'
import type { MovimientoCaja, Venta } from '@/dominio/tipos'

const venta = (id: string, fecha: string, total: number, extra: Partial<Venta> = {}): Venta => ({
  id, fecha: new Date(fecha).getTime(), total, medioPago: 'efectivo', clienteId: null,
  items: [{ productoId: 'y', nombre: 'Yerba', cantidad: 1, precio: total, costo: Math.round(total * 0.7) }], ...extra,
})

describe('resumen mensual', () => {
  const ventas = [
    venta('a', '2026-11-03T10:00:00', 100000),
    venta('b', '2026-11-03T12:00:00', 50000, { medioPago: 'qr' }),
    venta('c', '2026-11-10T10:00:00', 200000, { estado: 'anulada' }),
    venta('d', '2026-10-15T10:00:00', 100000),
  ]
  const gastos = [{ id: 'm', fecha: new Date('2026-11-04').getTime(), tipo: 'salida', concepto: 'Bolsas', monto: 5000, medioPago: 'efectivo' }] as MovimientoCaja[]

  it('junta lo del mes, sin anuladas, con medios, días y contra el mes anterior', () => {
    const r = resumenMensual(ventas, gastos, [{ id: 'p', fiadoId: 'f', monto: 7000, fecha: new Date('2026-11-05').getTime() }] as never, [{ monto: 10000 }], 2026, 10)
    expect(r.titulo).toBe('noviembre de 2026')
    expect(r.vendido).toBe(150000)
    expect(r.cantidadVentas).toBe(2)
    expect(r.anulaciones).toBe(1)
    expect(r.porMedio).toMatchObject({ efectivo: 100000, qr: 50000 })
    expect(r.porDia).toHaveLength(30)
    expect(r.mejorDia).toEqual({ dia: 3, monto: 150000 })
    expect(r.ganancia).toBe(45000)
    expect(r.queda).toBe(45000 - 5000 - 10000)
    expect(r.cobradoDeFiados).toBe(7000)
    expect(r.contraMesAnterior).toBe(50)
  })

  it('ofrece los meses desde el actual hasta el de la primera venta', () => {
    const meses = mesesDisponibles(ventas, new Date('2026-11-07').getTime())
    expect(meses.map((m) => m.titulo)).toEqual(['noviembre de 2026', 'octubre de 2026'])
  })
})
