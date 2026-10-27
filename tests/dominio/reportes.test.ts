import { describe, expect, it } from 'vitest'
import type { Venta } from '@/dominio/tipos'
import {
  etiquetaPeriodo,
  filtrarVentas,
  porcentajeMargen,
  rangoReporte,
  rankingProductos,
  resumenPeriodo,
  valorStock,
} from '@/dominio/reportes'

const AHORA = new Date(2026, 7, 31, 15, 0).getTime()
const venta = (parcial: Partial<Venta> = {}): Venta => ({
  id: 'v1', fecha: AHORA, total: 100000, medioPago: 'efectivo', clienteId: null,
  items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 50000, costo: 30000 }],
  ...parcial,
})

describe('reportes', () => {
  it('arma períodos locales de hoy, 7 y 30 días', () => {
    expect(rangoReporte('hoy', AHORA).desde).toBe(new Date(2026, 7, 31).getTime())
    expect(rangoReporte('7dias', AHORA).desde).toBe(new Date(2026, 7, 25).getTime())
    expect(rangoReporte('30dias', AHORA).desde).toBe(new Date(2026, 7, 2).getTime())
  })

  it('calcula ventas, ganancia, ticket promedio y distribución de cobros', () => {
    const resumen = resumenPeriodo([
      venta(),
      venta({ id: 'v2', total: 50000, medioPago: 'qr', items: [{ productoId: 'p2', nombre: 'Pan', cantidad: 1, precio: 50000, costo: 20000 }] }),
    ], 'hoy', AHORA)
    expect(resumen.vendido).toBe(150000)
    expect(resumen.ganancia).toBe(70000)
    expect(resumen.cantidadVentas).toBe(2)
    expect(resumen.unidades).toBe(3)
    expect(resumen.ticketPromedio).toBe(75000)
    expect(resumen.porcentajePorMedio.efectivo).toBe(67)
    expect(resumen.porcentajePorMedio.qr).toBe(33)
  })

  it('rankea productos por facturación y calcula valor de stock', () => {
    const ranking = rankingProductos([venta(), venta({ id: 'v2', medioPago: 'qr' })], 'todo', AHORA)
    expect(ranking[0]).toMatchObject({ productoId: 'p1', unidades: 4, vendido: 200000, ganancia: 80000 })
    expect(valorStock([{ id: 'p1', nombre: 'Yerba', codigoBarras: null, costo: 30000, precio: 50000, stock: 10, stockMinimo: 2, actualizadoEn: 0 }])).toEqual({ costo: 300000, venta: 500000, unidades: 10 })
  })

  it('filtra por el rango y calcula el margen', () => {
    const viejita = venta({ id: 'vieja', fecha: new Date(2026, 7, 1, 12).getTime() })
    expect(filtrarVentas([viejita, venta()], rangoReporte('7dias', AHORA))).toHaveLength(1)
    expect(porcentajeMargen(150000, 60000)).toBe(40)
    expect(etiquetaPeriodo('30dias')).toBe('Últimos 30 días')
  })

  it('no cuenta ventas anuladas en los reportes, pero permite auditarlas', () => {
    const anulada = venta({ estado: 'anulada', total: 900000 })
    expect(resumenPeriodo([anulada], 'todo', AHORA).vendido).toBe(0)
    expect(filtrarVentas([anulada], rangoReporte('todo', AHORA))).toHaveLength(0)
    expect(filtrarVentas([anulada], rangoReporte('todo', AHORA), true)).toHaveLength(1)
  })
})
