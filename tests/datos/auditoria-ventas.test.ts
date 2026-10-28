import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorStockInsuficiente, ErrorVentaInvalida, repos } from '@/datos/local/repos'
import type { ItemVenta, Producto } from '@/dominio/tipos'

/** Auditoría de los flujos de plata: cada caso es un error que se podía
 *  cometer desde el mostrador y que la base tiene que frenar sola, aunque
 *  la pantalla falle. */

const base: Omit<Producto, 'id' | 'actualizadoEn'> = {
  codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 5, stockMinimo: 1,
}

const item = (producto: Producto, cambios: Partial<ItemVenta> = {}): ItemVenta => ({
  productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: producto.precio, costo: producto.costo, ...cambios,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('ventas: lo que nunca se puede cobrar', () => {
  it('un producto sin precio ($0) no se vende', async () => {
    const regalo = await repos.productos.guardar({ ...base, nombre: 'Chinchulín', precio: 0 })
    await expect(repos.ventas.registrar({ items: [item(regalo)], medioPago: 'efectivo', clienteId: null }))
      .rejects.toBeInstanceOf(ErrorVentaInvalida)
    expect(await db.ventas.count()).toBe(0)
    expect((await db.productos.get(regalo.id))?.stock).toBe(5)
  })

  it('cantidades en cero, negativas o con coma no pasan', async () => {
    const yerba = await repos.productos.guardar(base)
    for (const cantidad of [0, -2, 1.5, Number.NaN]) {
      await expect(repos.ventas.registrar({ items: [item(yerba, { cantidad })], medioPago: 'efectivo', clienteId: null }))
        .rejects.toBeInstanceOf(ErrorVentaInvalida)
    }
    expect((await db.productos.get(yerba.id))?.stock).toBe(5)
  })

  it('un ticket vacío no es una venta', async () => {
    await expect(repos.ventas.registrar({ items: [], medioPago: 'efectivo', clienteId: null }))
      .rejects.toBeInstanceOf(ErrorVentaInvalida)
  })

  it('fiado sin cliente no se anota', async () => {
    const yerba = await repos.productos.guardar(base)
    await expect(repos.ventas.registrar({ items: [item(yerba)], medioPago: 'fiado', clienteId: null }))
      .rejects.toBeInstanceOf(ErrorVentaInvalida)
    expect(await db.fiados.count()).toBe(0)
  })

  it('el stock reservado por un pedido no se puede vender en el mostrador', async () => {
    const yerba = await repos.productos.guardar({ ...base, stock: 2 })
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    await repos.pedidos.guardar({
      clienteId: cliente.id, items: [item(yerba, { cantidad: 2 })], estado: 'pendiente', reservarStock: true,
      tipoEntrega: 'retiro', fechaEntrega: null, direccion: null, nota: null,
    })
    await expect(repos.ventas.registrar({ items: [item(yerba)], medioPago: 'efectivo', clienteId: null }))
      .rejects.toBeInstanceOf(ErrorStockInsuficiente)
  })

  it('vender todo lo que queda deja el stock en cero, nunca negativo', async () => {
    const yerba = await repos.productos.guardar({ ...base, stock: 2 })
    await repos.ventas.registrar({ items: [item(yerba, { cantidad: 2 })], medioPago: 'efectivo', clienteId: null })
    await expect(repos.ventas.registrar({ items: [item(yerba)], medioPago: 'efectivo', clienteId: null }))
      .rejects.toBeInstanceOf(ErrorStockInsuficiente)
    expect((await db.productos.get(yerba.id))?.stock).toBe(0)
  })
})

describe('fiados: pagos', () => {
  it('un pago no se "come" en un fiado anulado: va a la deuda que sigue viva', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Raúl', telefono: null })
    await db.fiados.add({ id: 'viejo', clienteId: cliente.id, ventaId: null, monto: 100000, fecha: 1, vence: null, anuladoEn: 2 } as never)
    await db.fiados.add({ id: 'vivo', clienteId: cliente.id, ventaId: null, monto: 50000, fecha: 3, vence: null })

    const aplicado = await repos.fiados.pagarCliente(cliente.id, 50000)

    expect(aplicado).toBe(50000)
    const pagos = await db.fiadoPagos.toArray()
    expect(pagos).toHaveLength(1)
    expect(pagos[0].fiadoId).toBe('vivo')
  })

  it('pagar de más sólo descuenta lo que se debe', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    await db.fiados.add({ id: 'f', clienteId: cliente.id, ventaId: null, monto: 30000, fecha: 1, vence: null })
    expect(await repos.fiados.pagarCliente(cliente.id, 50000)).toBe(30000)
  })
})
