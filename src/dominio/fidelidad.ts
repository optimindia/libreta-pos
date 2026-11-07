import type { Centavos, Venta } from './tipos'
import type { Descuento } from './ventaAbierta'

/** "La décima gratis": cada `cadaCompras` compras de al menos `minimo`, el
 *  cliente gana un premio (un % o un monto de descuento) para la siguiente. */
export interface ConfigFidelidad {
  activa: boolean
  cadaCompras: number
  minimo: Centavos
  premio: Descuento
}

export const FIDELIDAD_INICIAL: ConfigFidelidad = { activa: false, cadaCompras: 10, minimo: 0, premio: { tipo: 'porcentaje', valor: 10 } }

export function normalizarFidelidad(crudo: unknown): ConfigFidelidad | undefined {
  if (!crudo || typeof crudo !== 'object') return undefined
  const dato = crudo as Record<string, unknown>
  const cada = Number(dato.cadaCompras)
  const minimo = Number(dato.minimo)
  const premio = dato.premio as Descuento | undefined
  if (!Number.isInteger(cada) || cada < 2 || cada > 100) return undefined
  if (!premio || (premio.tipo !== 'porcentaje' && premio.tipo !== 'pesos') || !Number.isFinite(premio.valor) || premio.valor <= 0) return undefined
  if (premio.tipo === 'porcentaje' && premio.valor > 100) return undefined
  return {
    activa: dato.activa === true,
    cadaCompras: cada,
    minimo: Number.isInteger(minimo) && minimo > 0 ? minimo : 0,
    premio: { tipo: premio.tipo, valor: premio.valor } as Descuento,
  }
}

export interface EstadoFidelidad {
  /** Sellos juntados desde el último premio usado. */
  sellos: number
  cadaCompras: number
  /** Premios ganados y todavía sin usar. */
  premios: number
  faltan: number
}

/** Cuenta los sellos del cliente con sus ventas: cada compra válida suma
 *  uno; la compra en la que usó un premio no suma y descuenta un premio. */
export function estadoFidelidad(ventas: Venta[], clienteId: string, config: ConfigFidelidad): EstadoFidelidad {
  let sellos = 0
  let usados = 0
  for (const venta of ventas) {
    if (venta.clienteId !== clienteId || venta.estado === 'anulada') continue
    if (venta.canjeFidelidad) { usados += 1; continue }
    if (venta.total >= config.minimo) sellos += 1
  }
  const ganados = Math.floor(sellos / config.cadaCompras)
  const premios = Math.max(0, ganados - usados)
  const resto = sellos % config.cadaCompras
  return { sellos: resto, cadaCompras: config.cadaCompras, premios, faltan: config.cadaCompras - resto }
}

export function textoPremio(premio: Descuento, formatearPesos: (c: Centavos) => string): string {
  return premio.tipo === 'porcentaje' ? `${premio.valor}% de descuento` : `${formatearPesos(premio.valor)} de descuento`
}
