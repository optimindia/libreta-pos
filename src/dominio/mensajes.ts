import { formatearCantidad } from './cantidad'
import type { Centavos, Cliente, Negocio, Pedido, Venta } from './tipos'
import type { SugerenciaCompra } from './reposicion'
import { formatearPesos } from './dinero'

function plural(cantidad: number, singular: string, plural: string): string {
  return cantidad === 1 ? `${cantidad} ${singular}` : `${cantidad} ${plural}`
}

export function mensajeCobro(cliente: Cliente, saldo: Centavos, dias: number): string {
  return [
    `Hola ${cliente.nombre}, ¿cómo andás?`,
    ``,
    `Te paso el saldo de la libreta: ${formatearPesos(saldo)}, de hace ${plural(dias, 'día', 'días')}.`,
    ``,
    `Cuando puedas te lo abono y listo. ¡Gracias!`,
  ].join('\n')
}

export function mensajePagoFiado(cliente: Cliente, pago: Centavos, saldo: Centavos): string {
  return [
    `Hola ${cliente.nombre}, registré tu pago de ${formatearPesos(pago)}.`,
    '',
    `Saldo pendiente: ${formatearPesos(saldo)}.`,
    '',
    '¡Gracias!',
  ].join('\n')
}

export function mensajeCompra(sugerencias: SugerenciaCompra[]): string {
  if (sugerencias.length === 0) {
    return 'No hace falta reponer nada por ahora.'
  }
  const lineas = sugerencias.map(
    (sugerencia) => `• ${sugerencia.producto.nombre} — ${sugerencia.cantidadSugerida}`,
  )
  return ['Hola, te hago este pedido:', '', ...lineas, '', '¿Me confirmás precio y entrega?'].join('\n')
}

export interface ResumenCierre {
  vendido: Centavos
  ganancia: Centavos
  contado: Centavos
  diferencia: Centavos
}

/** El resumen del día que el almacenero se manda a sí mismo al cerrar. */
export function mensajeCierre(resumen: ResumenCierre): string {
  if (resumen.diferencia === 0) {
    return [
      'Caja cerrada, día terminado.',
      '',
      `Vendido: ${formatearPesos(resumen.vendido)}`,
      `Ganancia: ${formatearPesos(resumen.ganancia)}`,
      `En caja: ${formatearPesos(resumen.contado)}`,
      '',
      'La caja cuadró. Buen trabajo.',
    ].join('\n')
  }
  const sobrante = resumen.diferencia > 0
  return [
    'Caja cerrada, día terminado.',
    '',
    `Vendido: ${formatearPesos(resumen.vendido)}`,
    `Ganancia: ${formatearPesos(resumen.ganancia)}`,
    `En caja: ${formatearPesos(resumen.contado)}`,
    '',
    `${sobrante ? 'Sobró' : 'Faltó'} ${formatearPesos(Math.abs(resumen.diferencia))} respecto de lo esperado.`,
  ].join('\n')
}

export function mensajeResumen(
  periodo: string,
  resumen: { vendido: Centavos; ganancia: Centavos; cantidadVentas: number; ticketPromedio: Centavos },
): string {
  return [
    `Resumen de ${periodo.toLowerCase()}.`,
    '',
    `Vendido: ${formatearPesos(resumen.vendido)}`,
    `Ganancia estimada: ${formatearPesos(resumen.ganancia)}`,
    `Ventas: ${resumen.cantidadVentas}`,
    `Ticket promedio: ${formatearPesos(resumen.ticketPromedio)}`,
  ].join('\n')
}

/** El acceso que el admin le manda a un dueño o vendedor nuevo. La dirección
 *  es donde está publicada la app (se pasa desde afuera): así no queda un link
 *  viejo escrito a mano cuando cambia el dominio. */
export function mensajeAcceso(telefono: string, pin: string, direccion: string): string {
  return `Hola, ya está listo tu acceso a Libreta.\n\nTeléfono: ${telefono}\nPIN: ${pin}\n\nIngresá en ${direccion}`
}

export function enlaceWhatsApp(telefono: string, texto: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  const textoCodificado = encodeURIComponent(texto)
  if (soloDigitos === '') return `https://wa.me/?text=${textoCodificado}`
  const conPais = soloDigitos.startsWith('54') ? soloDigitos : `54${soloDigitos}`
  return `https://wa.me/${conPais}?text=${textoCodificado}`
}

/** Hora 24h y fecha legible, sin depender del locale del sistema. */
function fechaLegible(epoch: number): string {
  const d = new Date(epoch)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} — ${dia}/${mes}/${d.getFullYear()}`
}

/** El ticket de una venta, listo para mandar por WhatsApp. */
export function mensajeTicket(negocio: Negocio, venta: Venta): string {
  const lineas = venta.items.map(
    (item) => `${formatearCantidad(item.cantidad)} x ${item.nombre} — ${formatearPesos(Math.round(item.precio * item.cantidad))}`,
  )
  const partes = [
    `*${negocio.nombre}*`,
    'Ticket de compra',
    '',
    ...lineas,
    '',
    `*Total: ${formatearPesos(venta.total)}*`,
    fechaLegible(venta.fecha),
  ]
  if (venta.medioPago === 'fiado') {
    partes.push('', `Quedó en la libreta: ${formatearPesos(venta.total)}`)
  }
  partes.push('', '¡Gracias por tu compra!')
  return partes.join('\n')
}

export function mensajePedido(negocio: Negocio, pedido: Pedido, cliente?: Cliente | null): string {
  const lineas = pedido.items.map((item) => `${formatearCantidad(item.cantidad)} x ${item.nombre} — ${formatearPesos(Math.round(item.precio * item.cantidad))}`)
  const entrega = pedido.tipoEntrega === 'envio'
    ? `Envío a: ${pedido.direccion || 'dirección a confirmar'}`
    : 'Retiro en el local'
  return [
    `Hola${cliente?.nombre ? ` ${cliente.nombre}` : ''}, te confirmo tu pedido en *${negocio.nombre}*.`,
    '',
    ...lineas,
    '',
    `*Total: ${formatearPesos(pedido.total)}*`,
    entrega,
    pedido.fechaEntrega ? `Entrega: ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(pedido.fechaEntrega))}` : '',
    pedido.nota ? `Nota: ${pedido.nota}` : '',
    '',
    'Te aviso cuando esté listo. ¡Gracias!',
  ].filter(Boolean).join('\n')
}
