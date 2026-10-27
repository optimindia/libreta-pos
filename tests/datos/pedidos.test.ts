import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorStockInsuficiente, repos } from '@/datos/local/repos'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('repos.pedidos', () => {
  it('reserva unidades y evita que otra venta las prometa', async () => {
    const producto = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Gaseosa', costo: 100000, precio: 200000,
      stock: 3, stockMinimo: 1,
    })
    await repos.pedidos.guardar({
      estado: 'pendiente', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
      tipoEntrega: 'retiro', fechaEntrega: null, direccion: null, nota: null,
      reservarStock: true,
    })

    await expect(repos.ventas.registrar({
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
      medioPago: 'efectivo', clienteId: null,
    })).rejects.toBeInstanceOf(ErrorStockInsuficiente)
    expect((await db.productos.get(producto.id))?.stock).toBe(3)
  })

  it('al cobrar un pedido lo convierte en venta y descuenta stock una sola vez', async () => {
    const producto = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Pan', costo: 50000, precio: 100000,
      stock: 4, stockMinimo: 1,
    })
    const pedido = await repos.pedidos.guardar({
      estado: 'listo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
      tipoEntrega: 'retiro', fechaEntrega: null, direccion: null, nota: null,
      reservarStock: true,
    })
    const venta = await repos.pedidos.convertirEnVenta(pedido.id, 'efectivo')
    const cerrado = await repos.pedidos.porId(pedido.id)
    expect(venta.pedidoId).toBe(pedido.id)
    expect(cerrado).toMatchObject({ estado: 'entregado', ventaId: venta.id })
    expect((await db.productos.get(producto.id))?.stock).toBe(2)
    expect((await repos.pedidos.convertirEnVenta(pedido.id, 'efectivo')).id).toBe(venta.id)
  })

  it('cancelar un pedido libera la reserva', async () => {
    const producto = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Leche', costo: 100000, precio: 200000,
      stock: 2, stockMinimo: 1,
    })
    const pedido = await repos.pedidos.guardar({
      estado: 'pendiente', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
      tipoEntrega: 'retiro', fechaEntrega: null, direccion: null, nota: null,
      reservarStock: true,
    })
    await repos.pedidos.cancelar(pedido.id)
    await expect(repos.ventas.registrar({
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
      medioPago: 'efectivo', clienteId: null,
    })).resolves.toBeTruthy()
  })
})
