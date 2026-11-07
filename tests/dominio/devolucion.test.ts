import { describe, it, expect } from 'vitest'
import { aplicarDevolucion, ErrorDevolucion } from '@/dominio/devolucion'
import type { Venta } from '@/dominio/tipos'

const base: Venta = {
  id: 'v1', fecha: 1, total: 1000000, medioPago: 'efectivo', clienteId: null, estado: 'completada',
  items: [
    { productoId: 'a', nombre: 'Yerba', cantidad: 2, precio: 400000, costo: 300000 },
    { productoId: 'b', nombre: 'Aceite', cantidad: 1, precio: 200000, costo: 150000 },
  ],
}
const datos = { id: 'd1', fecha: 2 }

describe('devolución parcial', () => {
  it('baja el renglón y el total, y deja anotado lo devuelto', () => {
    const { venta, devolucion, reparto } = aplicarDevolucion(base, [{ productoId: 'a', cantidad: 1 }], datos)
    expect(venta.items[0].cantidad).toBe(1)
    expect(venta.total).toBe(600000)
    expect(devolucion).toMatchObject({ monto: 400000, items: [{ productoId: 'a', cantidad: 1 }] })
    expect(venta.devoluciones).toHaveLength(1)
    expect(reparto).toEqual({ fiado: 0, efectivo: 400000, digital: 0 })
  })

  it('un renglón devuelto entero se va de la venta', () => {
    const { venta } = aplicarDevolucion(base, [{ productoId: 'b', cantidad: 1 }], datos)
    expect(venta.items.map((i) => i.productoId)).toEqual(['a'])
  })

  it('no deja devolver todo (para eso se anula) ni más de lo que llevó', () => {
    expect(() => aplicarDevolucion(base, [{ productoId: 'a', cantidad: 2 }, { productoId: 'b', cantidad: 1 }], datos)).toThrow(/anulá/)
    expect(() => aplicarDevolucion(base, [{ productoId: 'a', cantidad: 3 }], datos)).toThrow(ErrorDevolucion)
  })

  it('en un pago dividido baja primero lo fiado, después el efectivo', () => {
    const dividida: Venta = { ...base, medioPago: 'efectivo', pagos: [{ medio: 'efectivo', monto: 700000 }, { medio: 'fiado', monto: 300000 }] }
    const { venta, reparto } = aplicarDevolucion(dividida, [{ productoId: 'a', cantidad: 1 }], datos)
    expect(reparto).toEqual({ fiado: 300000, efectivo: 100000, digital: 0 })
    expect(venta.pagos).toBeUndefined()
    expect(venta.medioPago).toBe('efectivo')
  })
})
