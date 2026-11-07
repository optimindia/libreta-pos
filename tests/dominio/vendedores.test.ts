import { describe, it, expect } from 'vitest'
import { normalizarVendedores, rendimientoPorVendedor } from '@/dominio/vendedores'
import { etiquetaVendedor, SIN_DATO } from '@/dominio/turno'
import type { Venta } from '@/dominio/tipos'

const v = (id: string, vendidoPor: string | null, total: number, fecha = 1000, estado?: Venta['estado']): Venta => ({
  id, fecha, total, medioPago: 'efectivo', clienteId: null, vendidoPor, estado,
  items: [{ productoId: 'p', nombre: 'p', cantidad: 1, precio: total, costo: Math.round(total * 0.7) }],
})

describe('rendimiento por vendedor', () => {
  it('suma lo vendido, la participación y la comisión de cada uno', () => {
    const filas = rendimientoPorVendedor([v('1', 'ana', 300000), v('2', 'ana', 100000), v('3', 'beto', 100000), v('4', 'beto', 999999, 1000, 'anulada'), v('5', null, 0)], 0, 2000, { ana: { comision: 5 } })
    expect(filas[0]).toMatchObject({ vendedor: 'ana', cantidadVentas: 2, vendido: 400000, participacion: 80, comision: 20000, ticketPromedio: 200000 })
    expect(filas[1]).toMatchObject({ vendedor: 'beto', vendido: 100000, comision: 0 })
    expect(filas.some((f) => f.vendedor === SIN_DATO)).toBe(true)
  })

  it('respeta el período', () => {
    expect(rendimientoPorVendedor([v('1', 'ana', 100, 5000)], 0, 2000)).toHaveLength(0)
  })

  it('los nombres anotados se usan en las etiquetas, y lo raro se descarta', () => {
    const config = normalizarVendedores({ ana: { nombre: '  Ana  ', comision: 5 }, beto: { comision: 80 }, x: 'raro' })
    expect(config).toEqual({ ana: { nombre: 'Ana', comision: 5 } })
    expect(etiquetaVendedor('ana', { usuarioId: 'yo' }, config)).toBe('Ana')
    expect(etiquetaVendedor('beto1234', { usuarioId: 'yo' }, config)).toBe('Vendedor 1234')
  })
})
