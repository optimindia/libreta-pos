import { describe, it, expect } from 'vitest'
import {
  ajustarPorcentaje,
  cambiosPorMargen,
  cambiosPorPorcentaje,
  precioConMargen,
  redondearPrecio,
} from '@/dominio/precios'
import type { Producto } from '@/dominio/tipos'

function producto(parcial: Partial<Producto> & Pick<Producto, 'id'>): Producto {
  return {
    codigoBarras: null,
    nombre: parcial.nombre ?? 'Producto',
    costo: 0,
    precio: 0,
    stock: 0,
    stockMinimo: 0,
    actualizadoEn: 0,
    ...parcial,
  }
}

describe('redondearPrecio', () => {
  it('redondea hacia arriba al múltiplo de $10', () => {
    expect(redondearPrecio(384700)).toBe(385000)
    expect(redondearPrecio(384001)).toBe(385000)
  })

  it('deja quieto lo que ya está redondeado', () => {
    expect(redondearPrecio(385000)).toBe(385000)
    expect(redondearPrecio(0)).toBe(0)
  })
})

describe('ajustarPorcentaje', () => {
  it('sube el precio y redondea', () => {
    expect(ajustarPorcentaje(485000, 10)).toBe(534000)
  })

  it('también sabe bajar precios', () => {
    expect(ajustarPorcentaje(485000, -5)).toBe(461000)
  })
})

describe('precioConMargen', () => {
  it('calcula el precio de venta desde el costo con el margen elegido', () => {
    expect(precioConMargen(485000, 25)).toBe(607000)
  })

  it('con margen cero devuelve el costo redondeado', () => {
    expect(precioConMargen(485000, 0)).toBe(485000)
  })
})

describe('cambiosPorPorcentaje', () => {
  const yerba = producto({ id: 'yerba', nombre: 'Yerba', precio: 485000 })
  const fideos = producto({ id: 'fideos', nombre: 'Fideos', precio: 89000 })

  it('calcula el precio nuevo de cada producto', () => {
    const cambios = cambiosPorPorcentaje([yerba, fideos], 10)
    expect(cambios.map((c) => c.producto.id)).toEqual(['yerba', 'fideos'])
    expect(cambios[0].precioActual).toBe(485000)
    expect(cambios[0].precioNuevo).toBe(534000)
  })

  it('respeta los productos desmarcados', () => {
    const cambios = cambiosPorPorcentaje([yerba, fideos], 10, new Set(['yerba']))
    expect(cambios.map((c) => c.producto.id)).toEqual(['fideos'])
  })

  it('omite los que no cambian (porcentaje cero)', () => {
    expect(cambiosPorPorcentaje([yerba], 0)).toHaveLength(0)
  })
})

describe('cambiosPorMargen', () => {
  it('recalcula desde el costo: el precio depende de lo que pagó el mayorista', () => {
    const yerba = producto({ id: 'yerba', nombre: 'Yerba', costo: 485000, precio: 607000 })
    const cambios = cambiosPorMargen([yerba], 30)
    expect(cambios[0].precioNuevo).toBe(precioConMargen(485000, 30))
  })

  it('no inventa precios para productos sin costo cargado', () => {
    const sinCosto = producto({ id: 'sin', costo: 0, precio: 100000 })
    expect(cambiosPorMargen([sinCosto], 25)).toHaveLength(0)
  })

  it('omite los que ya tienen ese precio', () => {
    const yerba = producto({ id: 'yerba', costo: 485000, precio: 607000 })
    expect(cambiosPorMargen([yerba], 25)).toHaveLength(0)
  })
})