import { describe, expect, it } from 'vitest'
import type { Producto } from '@/dominio/tipos'
import { agregarItemPedido, cambiarCantidadPedido, pedidoReservaStock, siguienteEstadoPedido, totalPedido } from '@/dominio/pedidos'
import { agregarProducto } from '@/dominio/ticket'

const producto: Producto = {
  id: 'p1', codigoBarras: '779123', nombre: 'Yerba', costo: 300000, precio: 420000,
  stock: 10, stockMinimo: 2, actualizadoEn: 0,
}

describe('herramientas de pedidos y ofertas', () => {
  it('usa una oferta vigente al armar una venta nueva', () => {
    const conOferta = { ...producto, precioOferta: 350000, ofertaHasta: Date.now() + 86_400_000 }
    expect(agregarProducto([], conOferta)[0].precio).toBe(350000)
    expect(agregarProducto([], { ...conOferta, ofertaHasta: Date.now() - 1 })[0].precio).toBe(420000)
  })

  it('agrega, cambia y totaliza items del pedido', () => {
    let items = agregarItemPedido([], producto)
    items = agregarItemPedido(items, producto)
    items = cambiarCantidadPedido(items, producto.id, 3)
    expect(items[0].cantidad).toBe(3)
    expect(totalPedido(items)).toBe(1_260_000)
  })

  it('mantiene la reserva sólo en estados operativos', () => {
    expect(pedidoReservaStock({ reservarStock: true, estado: 'pendiente' })).toBe(true)
    expect(pedidoReservaStock({ reservarStock: true, estado: 'entregado' })).toBe(false)
    expect(siguienteEstadoPedido('pendiente')).toBe('preparando')
    expect(siguienteEstadoPedido('listo')).toBe('entregado')
  })
})
