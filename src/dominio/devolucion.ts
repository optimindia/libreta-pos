import type { Centavos, ItemVenta, MedioPago, UUID, Venta } from './tipos'
import { totalTicket } from './ticket'
import { redondearCantidad } from './cantidad'
import { medioPrincipal, partesDePago, type PartePago } from './pagos'

/** Lo que se devolvió de una venta: queda anotado en la venta. */
export interface Devolucion {
  id: UUID
  fecha: number
  items: ItemVenta[]
  monto: Centavos
  motivo?: string
}

export interface PedidoDevolucion {
  productoId: UUID
  cantidad: number
}

/** De dónde sale la plata devuelta. */
export interface RepartoDevolucion {
  fiado: Centavos
  efectivo: Centavos
  digital: Centavos
}

export class ErrorDevolucion extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'ErrorDevolucion'
  }
}

/** Primero se descuenta de lo fiado (baja la deuda), después del efectivo
 *  y al final de lo digital. */
const ORDEN: MedioPago[] = ['fiado', 'efectivo', 'transferencia', 'qr']

/** Calcula la venta después de devolver algunos productos: los renglones
 *  bajan (o se van), el total baja, y las partes del pago bajan en orden.
 *  No toca el stock ni la caja: eso lo hace quien la guarda. */
export function aplicarDevolucion(
  venta: Venta,
  pedido: PedidoDevolucion[],
  datos: { id: UUID; fecha: number; motivo?: string },
): { venta: Venta; devolucion: Devolucion; reparto: RepartoDevolucion } {
  if (venta.estado === 'anulada') throw new ErrorDevolucion('La venta está anulada.')
  const pedidos = pedido.filter((p) => p.cantidad > 0)
  if (pedidos.length === 0) throw new ErrorDevolucion('Elegí qué productos devuelve.')

  const items = venta.items.map((item) => ({ ...item }))
  const devueltos: ItemVenta[] = []
  for (const p of pedidos) {
    const item = items.find((i) => i.productoId === p.productoId)
    if (!item) throw new ErrorDevolucion('Ese producto no está en la venta.')
    if (p.cantidad > item.cantidad + 1e-9) throw new ErrorDevolucion(`De ${item.nombre} se vendieron ${item.cantidad}: no se puede devolver más.`)
    item.cantidad = redondearCantidad(item.cantidad - p.cantidad)
    devueltos.push({ ...item, cantidad: p.cantidad })
  }
  const quedan = items.filter((item) => item.cantidad > 0)
  if (quedan.length === 0) throw new ErrorDevolucion('Si devuelve todo, anulá la venta: así se devuelve todo junto.')

  const total = totalTicket(quedan)
  const monto = venta.total - total
  if (monto <= 0) throw new ErrorDevolucion('No hay nada para devolver.')

  // Las partes del pago bajan en orden hasta cubrir lo devuelto.
  let falta = monto
  const reparto: RepartoDevolucion = { fiado: 0, efectivo: 0, digital: 0 }
  const partes: PartePago[] = partesDePago(venta).map((parte) => ({ ...parte }))
  for (const medio of ORDEN) {
    for (const parte of partes.filter((x) => x.medio === medio)) {
      if (falta <= 0) break
      const baja = Math.min(parte.monto, falta)
      parte.monto -= baja
      falta -= baja
      if (medio === 'fiado') reparto.fiado += baja
      else if (medio === 'efectivo') reparto.efectivo += baja
      else reparto.digital += baja
    }
  }
  const vivas = partes.filter((parte) => parte.monto > 0)

  const devolucion: Devolucion = { id: datos.id, fecha: datos.fecha, items: devueltos, monto, ...(datos.motivo?.trim() ? { motivo: datos.motivo.trim() } : {}) }
  const { pagos: _pagosViejos, ...resto } = venta
  void _pagosViejos
  const nueva: Venta = {
    ...resto,
    items: quedan,
    total,
    medioPago: vivas.length > 0 ? medioPrincipal(vivas) : venta.medioPago,
    ...(vivas.length > 1 ? { pagos: vivas } : {}),
    devoluciones: [...(venta.devoluciones ?? []), devolucion],
  }
  return { venta: nueva, devolucion, reparto }
}

/** Lo devuelto en total de una venta. */
export function totalDevuelto(venta: Pick<Venta, 'devoluciones'>): Centavos {
  return (venta.devoluciones ?? []).reduce((total, d) => total + d.monto, 0)
}
