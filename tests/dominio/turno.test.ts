import { describe, expect, it } from 'vitest'
import {
  SIN_DATO, desdeDelTurno, desgloseDelDia, etiquetaVendedor, filtrarPorVendedor, resumenTurno, vendedoresPresentes,
} from '@/dominio/turno'
import type { Cierre, FiadoPago, Venta } from '@/dominio/tipos'

const HOY = new Date(2026, 9, 29, 15, 0, 0).getTime()
const hora = (h: number) => new Date(2026, 9, 29, h, 0, 0).getTime()

const venta = (id: string, fecha: number, total: number, extra: Partial<Venta> = {}): Venta => ({
  id, fecha, total, medioPago: 'efectivo', clienteId: null,
  items: [{ productoId: 'p', nombre: 'Yerba', cantidad: 1, precio: total, costo: Math.round(total / 2) }],
  ...extra,
})
const pago = (id: string, fecha: number, monto: number, extra: Partial<FiadoPago> = {}): FiadoPago => ({ id, fiadoId: 'f', monto, fecha, ...extra })
const cierre = (id: string, fecha: number, extra: Partial<Cierre> = {}): Cierre => ({
  id, fecha, fondoInicial: 0, ventasEfectivo: 0, pagosFiadoEfectivo: 0, esperado: 0, contado: 0, ...extra,
})

describe('filtrarPorVendedor', () => {
  const lista = [
    venta('a', hora(9), 100, { vendidoPor: 'u1' }),
    venta('b', hora(10), 200, { vendidoPor: 'u2' }),
    venta('c', hora(11), 300),
    venta('d', hora(12), 400, { vendidoPor: null }),
  ]
  it('null deja todo', () => expect(filtrarPorVendedor(lista, null)).toHaveLength(4))
  it('un id deja sólo lo suyo', () => expect(filtrarPorVendedor(lista, 'u1').map((v) => v.id)).toEqual(['a']))
  it('SIN_DATO junta undefined y null', () => expect(filtrarPorVendedor(lista, SIN_DATO).map((v) => v.id)).toEqual(['c', 'd']))
})

describe('vendedoresPresentes', () => {
  it('lista ids únicos y avisa si hay filas sin dato', () => {
    const r = vendedoresPresentes([venta('a', 1, 1, { vendidoPor: 'u2' }), venta('b', 1, 1, { vendidoPor: 'u1' }), venta('c', 1, 1, { vendidoPor: 'u2' }), venta('d', 1, 1)])
    expect(r.ids).toEqual(['u1', 'u2'])
    expect(r.haySinDato).toBe(true)
  })
})

describe('etiquetaVendedor', () => {
  const yo = { usuarioId: 'u1', nombre: 'Lucía' }
  it('sin id es "Sin dato"', () => {
    expect(etiquetaVendedor(null, yo)).toBe('Sin dato')
    expect(etiquetaVendedor(undefined, yo)).toBe('Sin dato')
    expect(etiquetaVendedor(SIN_DATO, yo)).toBe('Sin dato')
  })
  it('uno mismo con nombre usa el nombre; sin nombre dice Vos', () => {
    expect(etiquetaVendedor('u1', yo)).toBe('Lucía')
    expect(etiquetaVendedor('u1', { usuarioId: 'u1' })).toBe('Vos')
  })
  it('otro vendedor lleva un sufijo corto y estable', () => {
    expect(etiquetaVendedor('abcd-1234-ef56', yo)).toBe('Vendedor ef56')
  })
})

describe('desdeDelTurno', () => {
  it('sin cierres de turno arranca al empezar el día', () => {
    expect(desdeDelTurno([], 'u1', HOY)).toBe(new Date(2026, 9, 29).getTime())
  })
  it('usa el último cierre de turno del mismo vendedor', () => {
    const cierres = [
      cierre('1', hora(8), { alcance: 'turno', usuarioId: 'u1' }),
      cierre('2', hora(12), { alcance: 'turno', usuarioId: 'u1' }),
      cierre('3', hora(14), { alcance: 'turno', usuarioId: 'u2' }),
      cierre('4', hora(14), { usuarioId: 'u1' }),
    ]
    expect(desdeDelTurno(cierres, 'u1', HOY)).toBe(hora(12))
  })
  it('un cierre de turno de ayer no estira el turno de hoy', () => {
    const ayer = new Date(2026, 9, 28, 20).getTime()
    expect(desdeDelTurno([cierre('1', ayer, { alcance: 'turno', usuarioId: 'u1' })], 'u1', HOY)).toBe(new Date(2026, 9, 29).getTime())
  })
})

describe('resumenTurno', () => {
  const ventas = [
    venta('a', hora(9), 1000, { vendidoPor: 'u1' }),
    venta('b', hora(10), 2000, { vendidoPor: 'u2' }),
    venta('c', hora(11), 500, { vendidoPor: 'u1', medioPago: 'transferencia' }),
    venta('d', hora(12), 700),
    venta('e', hora(13), 300, { vendidoPor: 'u1' }),
  ]
  const pagos = [pago('p1', hora(11), 400, { usuarioId: 'u1' }), pago('p2', hora(11), 900, { usuarioId: 'u2' })]

  it('cuenta sólo el efectivo y los pagos del vendedor desde su último cierre', () => {
    const r = resumenTurno(ventas, pagos, 'u1', hora(9) - 1, HOY)
    expect(r.ventasEfectivo).toBe(1300)
    expect(r.pagosFiadoEfectivo).toBe(400)
    expect(r.esperado).toBe(1700)
    expect(r.cantidadVentas).toBe(3)
    expect(r.vendido).toBe(1800)
  })
  it('respeta el desde: lo anterior al cierre no entra', () => {
    expect(resumenTurno(ventas, pagos, 'u1', hora(10), HOY).esperado).toBe(300 + 400)
  })
  it('no expone ganancia ni costos', () => {
    const r = resumenTurno(ventas, pagos, 'u1', 0, HOY) as unknown as Record<string, unknown>
    expect(Object.keys(r).join(' ')).not.toMatch(/ganancia|costo/i)
  })
})

describe('desgloseDelDia', () => {
  it('arma una fila por vendedor con su turno cerrado y la diferencia', () => {
    const ventas = [venta('a', hora(9), 1000, { vendidoPor: 'u1' }), venta('b', hora(10), 2000, { vendidoPor: 'u2' }), venta('c', hora(11), 700)]
    const cierres = [cierre('1', hora(14), { alcance: 'turno', usuarioId: 'u1', esperado: 1000, contado: 900 })]
    const filas = desgloseDelDia(ventas, [], cierres, HOY)
    expect(filas.map((f) => f.vendedor)).toEqual(['u1', 'u2', SIN_DATO])
    const u1 = filas[0]
    expect(u1).toMatchObject({ cantidadVentas: 1, vendido: 1000, efectivo: 1000 })
    expect(u1.cierre).toMatchObject({ esperado: 1000, contado: 900, diferencia: -100 })
    expect(filas[1].cierre).toBeNull()
  })
  it('ignora lo de otros días', () => {
    const ayer = new Date(2026, 9, 28, 10).getTime()
    expect(desgloseDelDia([venta('a', ayer, 1000, { vendidoPor: 'u1' })], [], [], HOY)).toEqual([])
  })
})
