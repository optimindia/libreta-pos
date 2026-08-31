import { describe, it, expect } from 'vitest'
import { gananciaVenta, resumenDelDia, masVendidos } from '@/dominio/ganancia'
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

describe('masVendidos', () => {
  const dia = new Date('2026-08-30T00:00:00')

  it('suma las unidades del mismo producto entre varias ventas', () => {
    const v1 = venta({
      id: 'v1',
      items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 420000, costo: 300000 }],
    })
    const v2 = venta({
      id: 'v2',
      items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 3, precio: 420000, costo: 300000 }],
    })
    const [primero] = masVendidos([v1, v2], dia)
    expect(primero.nombre).toBe('Yerba')
    expect(primero.unidades).toBe(5)
  })

  it('ordena de mayor a menor cantidad vendida', () => {
    const v = venta({
      items: [
        { productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 },
        { productoId: 'p2', nombre: 'Fideos', cantidad: 10, precio: 120000, costo: 80000 },
      ],
    })
    const resultado = masVendidos([v], dia)
    expect(resultado[0].nombre).toBe('Fideos')
    expect(resultado[1].nombre).toBe('Yerba')
  })

  it('sólo cuenta las ventas de ese día', () => {
    const ayer = venta({ id: 'v0', fecha: new Date('2026-08-29T14:00:00').getTime() })
    expect(masVendidos([ayer], dia)).toHaveLength(0)
  })

  it('sin ventas devuelve la lista vacía', () => {
    expect(masVendidos([], dia)).toHaveLength(0)
  })

  it('respeta un límite de resultados', () => {
    const v = venta({
      items: [
        { productoId: 'p1', nombre: 'A', cantidad: 3, precio: 100, costo: 50 },
        { productoId: 'p2', nombre: 'B', cantidad: 2, precio: 100, costo: 50 },
        { productoId: 'p3', nombre: 'C', cantidad: 1, precio: 100, costo: 50 },
      ],
    })
    expect(masVendidos([v], dia, 2)).toHaveLength(2)
  })
})
