import { describe, it, expect } from 'vitest'
import { gananciaVenta, resumenDelDia } from '@/dominio/ganancia'
import type { Venta } from '@/dominio/tipos'

function venta(parcial: Partial<Venta>): Venta {
  return {
    id: 'v1', fecha: new Date('2026-08-30T14:00:00').getTime(),
    total: 420000, medioPago: 'efectivo', clienteId: null,
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }],
    ...parcial,
  }
}

describe('gananciaVenta', () => {
  it('resta el costo del precio, por cada item y cantidad', () => {
    expect(gananciaVenta(venta({}))).toBe(120000)
  })

  it('multiplica la ganancia por la cantidad vendida', () => {
    const v = venta({
      items: [{ productoId: 'p2', nombre: 'Pan', cantidad: 3, precio: 90000, costo: 50000 }],
    })
    expect(gananciaVenta(v)).toBe(120000)
  })

  it('un producto vendido a pérdida da ganancia negativa', () => {
    const v = venta({
      items: [{ productoId: 'p3', nombre: 'Oferta', cantidad: 1, precio: 100000, costo: 150000 }],
    })
    expect(gananciaVenta(v)).toBe(-50000)
  })

  it('el fiado también cuenta como venta ganada: la mercadería ya salió', () => {
    expect(gananciaVenta(venta({ medioPago: 'fiado' }))).toBe(120000)
  })
})

describe('resumenDelDia', () => {
  const dia = new Date('2026-08-30T00:00:00')

  it('suma sólo las ventas de ese día', () => {
    const ayer = venta({ id: 'v0', fecha: new Date('2026-08-29T14:00:00').getTime() })
    const hoy = venta({ id: 'v1' })
    const resumen = resumenDelDia([ayer, hoy], dia)
    expect(resumen.vendido).toBe(420000)
    expect(resumen.cantidadVentas).toBe(1)
  })

  it('acumula la ganancia del día', () => {
    const resumen = resumenDelDia([venta({}), venta({ id: 'v2' })], dia)
    expect(resumen.ganancia).toBe(240000)
  })

  it('separa lo vendido por medio de pago', () => {
    const resumen = resumenDelDia(
      [venta({}), venta({ id: 'v2', medioPago: 'fiado' })],
      dia,
    )
    expect(resumen.porMedioPago.efectivo).toBe(420000)
    expect(resumen.porMedioPago.fiado).toBe(420000)
    expect(resumen.porMedioPago.qr).toBe(0)
  })

  it('un día sin ventas devuelve todo en cero, no falla', () => {
    const resumen = resumenDelDia([], dia)
    expect(resumen.vendido).toBe(0)
    expect(resumen.ganancia).toBe(0)
    expect(resumen.cantidadVentas).toBe(0)
  })
})
