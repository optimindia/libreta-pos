import { describe, it, expect } from 'vitest'
import { agregarProducto, cambiarCantidad, totalTicket } from '@/dominio/ticket'
import type { Producto } from '@/dominio/tipos'

const yerba: Producto = {
  id: 'p1', codigoBarras: '779...', nombre: 'Yerba Playadito',
  costo: 300000, precio: 420000, stock: 10, stockMinimo: 3, actualizadoEn: 0,
}
const pan: Producto = {
  id: 'p2', codigoBarras: null, nombre: 'Pan francés',
  costo: 50000, precio: 90000, stock: 20, stockMinimo: 5, actualizadoEn: 0,
}

describe('agregarProducto', () => {
  it('agrega un producto nuevo con cantidad 1', () => {
    const items = agregarProducto([], yerba)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      productoId: 'p1', nombre: 'Yerba Playadito',
      cantidad: 1, precio: 420000, costo: 300000,
    })
  })

  it('escanear dos veces el mismo producto suma cantidad, no duplica la fila', () => {
    const items = agregarProducto(agregarProducto([], yerba), yerba)
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(2)
  })

  it('copia el precio y el costo del momento, no una referencia al producto', () => {
    const items = agregarProducto([], yerba)
    const yerbaAumentada = { ...yerba, precio: 500000 }
    agregarProducto(items, yerbaAumentada)
    expect(items[0].precio).toBe(420000)
  })

  it('no muta el arreglo recibido', () => {
    const original: never[] = []
    agregarProducto(original, yerba)
    expect(original).toHaveLength(0)
  })
})

describe('cambiarCantidad', () => {
  it('cambia la cantidad de un item', () => {
    const items = cambiarCantidad(agregarProducto([], pan), 'p2', 3)
    expect(items[0].cantidad).toBe(3)
  })

  it('quita el item si la cantidad baja a cero', () => {
    const items = cambiarCantidad(agregarProducto([], pan), 'p2', 0)
    expect(items).toHaveLength(0)
  })
})

describe('totalTicket', () => {
  it('suma cantidad por precio de cada item', () => {
    let items = agregarProducto([], yerba)
    items = agregarProducto(items, pan)
    items = cambiarCantidad(items, 'p2', 2)
    expect(totalTicket(items)).toBe(420000 + 180000)
  })

  it('el ticket vacío vale cero', () => {
    expect(totalTicket([])).toBe(0)
  })
})
