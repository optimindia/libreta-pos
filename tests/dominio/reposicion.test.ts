import { describe, it, expect } from 'vitest'
import { ventaDiariaPromedio, diasHastaAgotar, listaDeCompra } from '@/dominio/reposicion'
import type { Producto, Venta } from '@/dominio/tipos'

const AHORA = new Date('2026-08-30T12:00:00').getTime()
const DIA = 24 * 60 * 60 * 1000

const yerba: Producto = {
  id: 'p1', codigoBarras: null, nombre: 'Yerba',
  costo: 300000, precio: 420000, stock: 6, stockMinimo: 3, actualizadoEn: 0,
}

function ventaDe(cantidad: number, haceDias: number, id = `v${haceDias}-${cantidad}`): Venta {
  return {
    id, fecha: AHORA - haceDias * DIA, total: 420000 * cantidad,
    medioPago: 'efectivo', clienteId: null,
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad, precio: 420000, costo: 300000 }],
  }
}

describe('ventaDiariaPromedio', () => {
  it('promedia las unidades vendidas sobre la ventana de días', () => {
    const ventas = [ventaDe(2, 1), ventaDe(2, 2), ventaDe(2, 3)]
    expect(ventaDiariaPromedio('p1', ventas, AHORA, 6)).toBe(1)
  })

  it('ignora las ventas anteriores a la ventana', () => {
    const ventas = [ventaDe(2, 1), ventaDe(100, 90)]
    expect(ventaDiariaPromedio('p1', ventas, AHORA, 2)).toBe(1)
  })

  it('un producto que no se vendió promedia cero', () => {
    expect(ventaDiariaPromedio('p1', [], AHORA, 14)).toBe(0)
  })
})

describe('diasHastaAgotar', () => {
  it('divide el stock por la venta diaria', () => {
    const ventas = [ventaDe(3, 1), ventaDe(3, 2)]
    expect(diasHastaAgotar(yerba, ventas, AHORA)).toBe(14)
  })

  it('devuelve null si el producto no tiene movimiento: no se puede predecir', () => {
    expect(diasHastaAgotar(yerba, [], AHORA)).toBeNull()
  })

  it('devuelve cero si ya no hay stock', () => {
    expect(diasHastaAgotar({ ...yerba, stock: 0 }, [ventaDe(3, 1)], AHORA)).toBe(0)
  })
})

describe('listaDeCompra', () => {
  it('sugiere reponer lo que se agota dentro de la semana', () => {
    const ventas = [ventaDe(6, 1), ventaDe(6, 2)]
    const lista = listaDeCompra([yerba], ventas, AHORA)
    expect(lista).toHaveLength(1)
    expect(lista[0].producto.id).toBe('p1')
  })

  it('no sugiere lo que dura más de una semana', () => {
    const ventas = [ventaDe(1, 20)]
    expect(listaDeCompra([yerba], ventas, AHORA)).toHaveLength(0)
  })

  it('sugiere comprar para dos semanas de venta', () => {
    const ventas = [ventaDe(6, 1), ventaDe(6, 2)]
    const lista = listaDeCompra([yerba], ventas, AHORA)
    expect(lista[0].cantidadSugerida).toBe(6)
  })

  it('incluye faltantes sin movimiento reciente, sin poder estimar días', () => {
    const sinMovimiento = { ...yerba, id: 'p9', stock: 1, stockMinimo: 3 }
    const lista = listaDeCompra([sinMovimiento], [], AHORA)
    expect(lista).toHaveLength(1)
    expect(lista[0].diasRestantes).toBeNull()
  })

  it('ordena por urgencia: primero lo que se agota antes', () => {
    const otro: Producto = { ...yerba, id: 'p2', stock: 1 }
    const ventas = [ventaDe(6, 1), ventaDe(6, 2)]
    const lista = listaDeCompra([yerba, otro], ventas, AHORA)
    expect(lista[0].producto.id).toBe('p2')
  })
})
