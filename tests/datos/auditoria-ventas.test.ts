import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorIngresoInvalido, ErrorStockInsuficiente, ErrorVentaInvalida, repos } from '@/datos/local/repos'
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

describe('caja: anular una venta en efectivo', () => {
  it('la devolución saca la plata una sola vez: el cajón esperado vuelve a quedar como antes', async () => {
    const { esperadoEnCaja, movimientosEfectivo } = await import('@/dominio/caja')
    const yerba = await repos.productos.guardar(base)
    const antes = Date.now() - 1000
    const venta = await repos.ventas.registrar({ items: [item(yerba)], medioPago: 'efectivo', clienteId: null })
    await repos.ventas.anular(venta.id, 'Se equivocó de producto')

    const ventas = await db.ventas.toArray()
    const movimientos = await db.movimientosCaja.toArray()
    const esperado = esperadoEnCaja(1000000, movimientosEfectivo(ventas, [], antes, Date.now() + 1000, movimientos))

    // Entró $4.200, salió $4.200 de devolución: queda el fondo inicial.
    expect(esperado).toBe(1000000)
  })
})

describe('ingresos de mercadería', () => {
  it('una cantidad en cero, negativa o con coma no entra', async () => {
    const yerba = await repos.productos.guardar(base)
    for (const cantidad of [0, -3, 2.5]) {
      await expect(repos.ingresos.registrar({ proveedor: null, origen: 'manual', items: [{ productoId: yerba.id, cantidad, costoUnitario: 300000 }] }))
        .rejects.toBeInstanceOf(ErrorIngresoInvalido)
    }
    expect((await db.productos.get(yerba.id))?.stock).toBe(5)
    expect(await db.ingresos.count()).toBe(0)
  })

  it('un costo en $0 (factura mal leída) no borra el costo que ya tenía', async () => {
    const yerba = await repos.productos.guardar(base)
    await repos.ingresos.registrar({ proveedor: null, origen: 'foto', items: [{ productoId: yerba.id, cantidad: 2, costoUnitario: 0 }] })
    const despues = await db.productos.get(yerba.id)
    expect(despues?.stock).toBe(7)
    expect(despues?.costo).toBe(300000)
  })

  it('un producto que ya no existe no deja un movimiento de stock trabado en la cola', async () => {
    await repos.ingresos.registrar({ proveedor: null, origen: 'manual', items: [{ productoId: 'borrado', cantidad: 2, costoUnitario: 100 }] })
    const cola = await db.cola.toArray()
    expect(cola.some((item) => item.entidad === 'movimientoStock')).toBe(false)
  })
})

describe('pedidos', () => {
  const pedidoDe = (producto: Producto, cantidad: number) => ({
    clienteId: null, items: [item(producto, { cantidad })], estado: 'pendiente' as const, reservarStock: false,
    tipoEntrega: 'retiro' as const, fechaEntrega: null, direccion: null, nota: null,
  })

  it('no se anota un pedido con cantidades en cero, negativas o con coma', async () => {
    const yerba = await repos.productos.guardar(base)
    for (const cantidad of [0, -1, 1.5]) {
      await expect(repos.pedidos.guardar(pedidoDe(yerba, cantidad))).rejects.toThrow(/cantidad/i)
    }
    expect(await db.pedidos.count()).toBe(0)
  })

  it('no se puede marcar entregado sin cobrarlo: la mercadería saldría sin descontar stock', async () => {
    const yerba = await repos.productos.guardar(base)
    const pedido = await repos.pedidos.guardar(pedidoDe(yerba, 2))
    await expect(repos.pedidos.actualizarEstado(pedido.id, 'entregado')).rejects.toThrow(/cobr/i)
    expect((await db.pedidos.get(pedido.id))?.estado).toBe('pendiente')
  })

  it('un pedido ya cobrado no se puede editar ni reabrir', async () => {
    const yerba = await repos.productos.guardar(base)
    const pedido = await repos.pedidos.guardar(pedidoDe(yerba, 1))
    await repos.pedidos.convertirEnVenta(pedido.id, 'efectivo')
    await expect(repos.pedidos.guardar({ ...pedidoDe(yerba, 3), id: pedido.id })).rejects.toThrow(/ya se cobró/i)
    expect((await db.pedidos.get(pedido.id))?.items[0].cantidad).toBe(1)
  })
})
