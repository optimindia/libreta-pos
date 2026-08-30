import type { Centavos, Cliente } from './tipos'
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

export function mensajeCompra(sugerencias: SugerenciaCompra[]): string {
  if (sugerencias.length === 0) {
    return 'No hace falta reponer nada por ahora.'
  }
  const lineas = sugerencias.map(
    (sugerencia) => `• ${sugerencia.producto.nombre} — ${sugerencia.cantidadSugerida}`,
  )
  return ['Hola, te hago este pedido:', '', ...lineas, '', '¿Me confirmás precio y entrega?'].join('\n')
}

export function enlaceWhatsApp(telefono: string, texto: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  const conPais = soloDigitos.startsWith('54') ? soloDigitos : `54${soloDigitos}`
  return `https://wa.me/${conPais}?text=${encodeURIComponent(texto)}`
}
