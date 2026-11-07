import type { Centavos, Ingreso, Producto, Proveedor, Venta } from './tipos'
import { listaDeCompra } from './reposicion'
import { formatearCantidad, unidadDe } from './cantidad'
import { formatearPesos } from './dinero'

export interface RenglonPedido {
  producto: Producto
  cantidad: number
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Lo que conviene pedirle a este proveedor: sus productos que se están por
 *  acabar, con la cantidad sugerida para dos semanas de venta. */
export function pedidoSugerido(proveedor: Pick<Proveedor, 'id'>, productos: Producto[], ventas: Venta[], ahora: number): RenglonPedido[] {
  const suyos = productos.filter((producto) => producto.proveedorId === proveedor.id && !producto.eliminadoEn)
  return listaDeCompra(suyos, ventas, ahora).map((sugerencia) => ({ producto: sugerencia.producto, cantidad: sugerencia.cantidadSugerida }))
}

/** El mensaje para mandar por WhatsApp. */
export function mensajePedidoProveedor(negocio: string, proveedor: Pick<Proveedor, 'nombre'>, renglones: RenglonPedido[]): string {
  const lineas = renglones
    .filter((renglon) => renglon.cantidad > 0)
    .map((renglon) => {
      const unidad = unidadDe(renglon.producto)
      const cantidad = unidad === 'unidad' ? `${renglon.cantidad}` : formatearCantidad(renglon.cantidad, unidad)
      return `• ${cantidad} × ${renglon.producto.nombre}`
    })
  return [`Hola ${proveedor.nombre.split(' ')[0]}, te paso el pedido de ${negocio}:`, '', ...lineas, '', '¡Gracias!'].join('\n')
}

/** Las cargas de mercadería que se le compraron (por nombre del proveedor,
 *  como se escribe al cargar la factura), de la más nueva a la más vieja. */
export function comprasDelProveedor(proveedor: Pick<Proveedor, 'nombre'>, ingresos: Ingreso[]): Ingreso[] {
  const nombre = normalizar(proveedor.nombre)
  return ingresos.filter((ingreso) => ingreso.proveedor && normalizar(ingreso.proveedor) === nombre).sort((a, b) => b.fecha - a.fecha)
}

/** Cuánto costó una carga (cantidad por costo unitario). */
export function costoDeIngreso(ingreso: Ingreso): Centavos {
  return ingreso.items.reduce((total, item) => total + Math.round(item.cantidad * item.costoUnitario), 0)
}

export function textoDeuda(deuda: Centavos): string {
  return deuda > 0 ? `Le debés ${formatearPesos(deuda)}` : 'No le debés nada'
}
