import type { EstadoPedido, ItemPedido, Pedido, Producto, UUID } from './tipos'
import { precioVigente } from './ticket'
import { multiplicar, sumar } from './dinero'

export const ESTADOS_PEDIDO: EstadoPedido[] = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado']
export const ESTADOS_RESERVA: EstadoPedido[] = ['pendiente', 'preparando', 'listo']

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  listo: 'Listo para entregar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const COLOR_ESTADO_PEDIDO: Record<EstadoPedido, 'verde' | 'ambar' | 'tenue'> = {
  pendiente: 'ambar',
  preparando: 'verde',
  listo: 'verde',
  entregado: 'tenue',
  cancelado: 'tenue',
}

export function pedidoReservaStock(pedido: Pick<Pedido, 'estado' | 'reservarStock'>): boolean {
  return pedido.reservarStock && ESTADOS_RESERVA.includes(pedido.estado)
}

export function siguienteEstadoPedido(estado: EstadoPedido): EstadoPedido | null {
  if (estado === 'pendiente') return 'preparando'
  if (estado === 'preparando') return 'listo'
  if (estado === 'listo') return 'entregado'
  return null
}

export function totalPedido(items: Pick<ItemPedido, 'precio' | 'cantidad'>[]): number {
  return sumar(...items.map((item) => multiplicar(item.precio, item.cantidad)))
}

export function agregarItemPedido(items: ItemPedido[], producto: Producto): ItemPedido[] {
  const existente = items.find((item) => item.productoId === producto.id)
  if (existente) {
    return items.map((item) => item.productoId === producto.id
      ? { ...item, cantidad: item.cantidad + 1 }
      : item)
  }
  return [...items, {
    productoId: producto.id,
    nombre: producto.nombre,
    cantidad: 1,
    precio: precioVigente(producto),
    costo: producto.costo,
  }]
}

export function cambiarCantidadPedido(items: ItemPedido[], productoId: UUID, cantidad: number): ItemPedido[] {
  if (cantidad <= 0) return items.filter((item) => item.productoId !== productoId)
  return items.map((item) => item.productoId === productoId ? { ...item, cantidad } : item)
}

export function unidadesPedido(items: Pick<ItemPedido, 'cantidad'>[]): number {
  return items.reduce((total, item) => total + item.cantidad, 0)
}

export function fechaPedidoCorta(epoch: number | null): string {
  if (!epoch) return 'Sin fecha de entrega'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(epoch))
}

export function etiquetaEntrega(tipo: Pedido['tipoEntrega']): string {
  return tipo === 'envio' ? 'Envío a domicilio' : 'Retiro en el local'
}

