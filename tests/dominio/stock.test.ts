import { describe, it, expect } from 'vitest'
import { stockCalculado, faltantes } from '@/dominio/stock'
import type { Ingreso, Producto, Venta } from '@/dominio/tipos'

const ingreso: Ingreso = {
  id: 'i1', fecha: 0, proveedor: 'Mayorista', origen: 'manual',
  items: [{ productoId: 'p1', cantidad: 12, costoUnitario: 300000 }],
}

const venta: Venta = {
  id: 'v1', fecha: 0, total: 420000, medioPago: 'efectivo', clienteId: null,
  items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 420000, costo: 300000 }],
}

describe('stockCalculado', () => {
  it('resta lo vendido de lo que entró', () => {
    expect(stockCalculado('p1', [ingreso], [venta])).toBe(10)
  })

  it('sin movimientos, el stock es cero', () => {
    expect(stockCalculado('p1', [], [])).toBe(0)
  })

  it('ignora ingresos y ventas de otros productos', () => {
    const otroIngreso: Ingreso = {
      ...ingreso, id: 'i2',
      items: [{ productoId: 'OTRO', cantidad: 50, costoUnitario: 1 }],
    }
    expect(stockCalculado('p1', [ingreso, otroIngreso], [venta])).toBe(10)
  })

  it('puede dar negativo si se vendió más de lo cargado: es un dato, no un error', () => {
    const ventaGrande: Venta = {
      ...venta, id: 'v2',
      items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 20, precio: 420000, costo: 300000 }],
    }
    expect(stockCalculado('p1', [ingreso], [ventaGrande])).toBe(-8)
  })
})

describe('faltantes', () => {
  const producto = (id: string, stock: number, minimo: number): Producto => ({
    id, codigoBarras: null, nombre: id, costo: 1, precio: 2,
    stock, stockMinimo: minimo, actualizadoEn: 0,
  })

  it('lista los productos en el mínimo o por debajo', () => {
    const lista = faltantes([producto('a', 2, 3), producto('b', 3, 3), producto('c', 9, 3)])
    expect(lista.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('ignora los productos sin mínimo definido', () => {
    expect(faltantes([producto('a', 0, 0)])).toHaveLength(0)
  })

  it('ordena primero el más urgente', () => {
    const lista = faltantes([producto('a', 2, 3), producto('b', 0, 3)])
    expect(lista[0].id).toBe('b')
  })
})
