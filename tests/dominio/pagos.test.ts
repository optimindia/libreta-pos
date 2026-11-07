import { describe, it, expect } from 'vitest'
import { medioPrincipal, montoEnMedio, partesDePago, problemaDePagos, textoDePago } from '@/dominio/pagos'
import { resumenPeriodo } from '@/dominio/reportes'
import { movimientosEfectivo } from '@/dominio/caja'
import type { Venta } from '@/dominio/tipos'

const venta = (parcial: Partial<Venta>): Venta => ({ id: 'v', fecha: Date.now(), total: 800000, medioPago: 'efectivo', items: [], clienteId: null, ...parcial })

describe('pago dividido', () => {
  it('una venta de un solo medio es una sola parte con el total', () => {
    expect(partesDePago(venta({}))).toEqual([{ medio: 'efectivo', monto: 800000 }])
  })

  it('valida que las partes sumen el total, sean positivas y de medios distintos', () => {
    expect(problemaDePagos([{ medio: 'efectivo', monto: 500000 }, { medio: 'transferencia', monto: 300000 }], 800000)).toBeNull()
    expect(problemaDePagos([{ medio: 'efectivo', monto: 500000 }, { medio: 'transferencia', monto: 200000 }], 800000)).toMatch(/suman \$7\.000/)
    expect(problemaDePagos([{ medio: 'efectivo', monto: 500000 }, { medio: 'efectivo', monto: 300000 }], 800000)).toMatch(/distinto/)
    expect(problemaDePagos([{ medio: 'efectivo', monto: 800000 }, { medio: 'qr', monto: 0 }], 800000)).toMatch(/mayor a cero/)
    expect(problemaDePagos([{ medio: 'efectivo', monto: 800000 }], 800000)).toMatch(/dos partes/)
  })

  it('el medio principal es el de la parte más grande y el texto nombra las dos', () => {
    const pagos = [{ medio: 'efectivo' as const, monto: 300000 }, { medio: 'transferencia' as const, monto: 500000 }]
    expect(medioPrincipal(pagos)).toBe('transferencia')
    expect(textoDePago(venta({ pagos }))).toBe('Efectivo $3.000 + Transferencia $5.000')
    expect(montoEnMedio(venta({ pagos }), 'efectivo')).toBe(300000)
  })

  it('los reportes y la caja suman cada parte en su medio', () => {
    const ahora = Date.now()
    const dividida = venta({ fecha: ahora, medioPago: 'transferencia', pagos: [{ medio: 'efectivo', monto: 300000 }, { medio: 'transferencia', monto: 500000 }] })
    const resumen = resumenPeriodo([dividida], 'hoy', ahora)
    expect(resumen.porMedioPago).toMatchObject({ efectivo: 300000, transferencia: 500000 })
    expect(movimientosEfectivo([dividida], [], ahora - 1000, ahora + 1000).ventasEfectivo).toBe(300000)
  })
})
