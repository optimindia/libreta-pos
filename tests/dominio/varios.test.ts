import { describe, it, expect } from 'vitest'
import { CODIGO_VARIOS, esProductoVarios, sumarMontoLibre } from '@/dominio/varios'
import type { Producto } from '@/dominio/tipos'

const varios: Producto = { id: 'v', codigoBarras: CODIGO_VARIOS, nombre: 'Varios', costo: 0, precio: 0, stock: 1_000_000, stockMinimo: 0, actualizadoEn: 0 }
const yerba = { productoId: 'y', nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }

describe('sumarMontoLibre', () => {
  it('agrega un renglón "Varios" con el monto, sin costo', () => {
    expect(sumarMontoLibre([yerba], varios, 150000)).toEqual([yerba, { productoId: 'v', nombre: 'Varios', cantidad: 1, precio: 150000, costo: 0 }])
  })

  it('los montos siguientes se suman al mismo renglón', () => {
    const una = sumarMontoLibre([], varios, 150000)
    expect(sumarMontoLibre(una, varios, 50000)).toEqual([{ productoId: 'v', nombre: 'Varios', cantidad: 1, precio: 200000, costo: 0 }])
  })

  it('ignora montos vacíos, negativos o inválidos', () => {
    expect(sumarMontoLibre([yerba], varios, 0)).toEqual([yerba])
    expect(sumarMontoLibre([yerba], varios, -100)).toEqual([yerba])
    expect(sumarMontoLibre([yerba], varios, Number.NaN)).toEqual([yerba])
  })

  it('reconoce el producto interno por su código', () => {
    expect(esProductoVarios(varios)).toBe(true)
    expect(esProductoVarios({ codigoBarras: '779' })).toBe(false)
  })
})
