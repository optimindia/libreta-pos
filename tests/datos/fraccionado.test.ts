import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorVentaInvalida, repos } from '@/datos/local/repos'
import { porMonto } from '@/dominio/cantidad'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const pan = { codigoBarras: null, nombre: 'Pan francés', costo: 50000, precio: 95000, stock: 10, stockMinimo: 2, unidad: 'kg' as const }

describe('venta por kilo', () => {
  it('se vende medio kilo y el stock baja medio kilo', async () => {
    const producto = await repos.productos.guardar(pan)
    const venta = await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 0.5, precio: 95000, costo: 50000 }],
    })
    expect(venta.total).toBe(47500)
    expect((await db.productos.get(producto.id))?.stock).toBe(9.5)
  })

  it('"$500 de pan" cobra exactamente $500', async () => {
    const producto = await repos.productos.guardar(pan)
    const { cantidad, precio } = porMonto(95000, 50000)!
    const venta = await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad, precio, costo: 50000 }],
    })
    expect(venta.total).toBe(50000)
    expect((await db.productos.get(producto.id))?.stock).toBeCloseTo(10 - cantidad, 3)
  })

  it('un producto por unidad sigue sin aceptar decimales', async () => {
    const yerba = await repos.productos.guardar({ ...pan, nombre: 'Yerba', unidad: 'unidad', precio: 420000 })
    await expect(repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: yerba.id, nombre: 'Yerba', cantidad: 0.5, precio: 420000, costo: 50000 }],
    })).rejects.toBeInstanceOf(ErrorVentaInvalida)
  })

  it('el stock por kilo se ajusta con decimales', async () => {
    const producto = await repos.productos.guardar(pan)
    const ajustado = await repos.productos.ajustarStock(producto.id, 2.25)
    expect(ajustado?.stock).toBe(12.25)
  })
})
