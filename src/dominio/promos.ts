import type { Centavos, ItemVenta, UUID } from './tipos'

/** Promociones automáticas: se aplican solas al cobrar cuando el ticket
 *  cumple la condición.
 *  - nxm: "3x2" — llevando `lleva` unidades se pagan `paga`.
 *  - cantidad: "desde 6 unidades, 10% menos".
 *  - combo: varios productos juntos a un precio fijo. */
export type Promo =
  | { id: string; nombre: string; activa: boolean; tipo: 'nxm'; productoId: UUID; lleva: number; paga: number }
  | { id: string; nombre: string; activa: boolean; tipo: 'cantidad'; productoId: UUID; desde: number; porcentaje: number }
  | { id: string; nombre: string; activa: boolean; tipo: 'combo'; partes: Array<{ productoId: UUID; cantidad: number }>; precio: Centavos }

export interface PromoAplicada {
  promo: Promo
  veces: number
  ahorro: Centavos
}

export interface ResultadoPromos {
  /** Cuánto se descuenta de cada renglón (por producto). */
  porItem: Record<UUID, Centavos>
  aplicadas: PromoAplicada[]
}

const entero = (valor: unknown, minimo = 1) => typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo

/** Sólo promos bien formadas: lo que llega de otro aparato o de una versión
 *  vieja no puede romper el cobro. */
export function promoValida(promo: unknown): promo is Promo {
  if (!promo || typeof promo !== 'object') return false
  const p = promo as Promo
  if (typeof p.id !== 'string' || typeof p.nombre !== 'string' || typeof p.activa !== 'boolean') return false
  if (p.tipo === 'nxm') return typeof p.productoId === 'string' && entero(p.lleva, 2) && entero(p.paga) && p.paga < p.lleva
  if (p.tipo === 'cantidad') return typeof p.productoId === 'string' && entero(p.desde, 2) && typeof p.porcentaje === 'number' && p.porcentaje > 0 && p.porcentaje < 100
  if (p.tipo === 'combo') {
    return Array.isArray(p.partes) && p.partes.length >= 2
      && p.partes.every((parte) => typeof parte?.productoId === 'string' && entero(parte.cantidad))
      && new Set(p.partes.map((parte) => parte.productoId)).size === p.partes.length
      && entero(p.precio)
  }
  return false
}

/** Qué promos se cumplen con estos renglones y cuánto ahorra cada una.
 *  Primero los combos (usan unidades de varios productos) y después las de
 *  un solo producto con lo que quedó. Nunca descuenta más que el renglón. */
export function aplicarPromos(items: ItemVenta[], promos: Promo[]): ResultadoPromos {
  const porItem: Record<UUID, Centavos> = {}
  const aplicadas: PromoAplicada[] = []
  const vigentes = promos.filter((promo) => promo.activa && promoValida(promo))
  if (vigentes.length === 0 || items.length === 0) return { porItem, aplicadas }

  const renglon = new Map(items.map((item) => [item.productoId, item]))
  // Unidades enteras que quedan libres para otra promo.
  const libres = new Map(items.map((item) => [item.productoId, Math.floor(item.cantidad)]))
  const sumar = (productoId: UUID, monto: Centavos) => { porItem[productoId] = (porItem[productoId] ?? 0) + monto }

  for (const promo of vigentes) {
    if (promo.tipo !== 'combo') continue
    const veces = Math.min(...promo.partes.map((parte) => Math.floor((libres.get(parte.productoId) ?? 0) / parte.cantidad)))
    if (!Number.isFinite(veces) || veces <= 0) continue
    const lista = promo.partes.map((parte) => ({ parte, valor: (renglon.get(parte.productoId)?.precio ?? 0) * parte.cantidad }))
    const regular = lista.reduce((total, item) => total + item.valor, 0)
    const ahorroPorCombo = regular - promo.precio
    if (ahorroPorCombo <= 0) continue
    let repartido = 0
    lista.forEach(({ parte, valor }, indice) => {
      const ultimo = indice === lista.length - 1
      const parteAhorro = ultimo ? ahorroPorCombo - repartido : Math.round((ahorroPorCombo * valor) / regular)
      repartido += parteAhorro
      sumar(parte.productoId, parteAhorro * veces)
      libres.set(parte.productoId, (libres.get(parte.productoId) ?? 0) - parte.cantidad * veces)
    })
    aplicadas.push({ promo, veces, ahorro: ahorroPorCombo * veces })
  }

  for (const promo of vigentes) {
    if (promo.tipo === 'combo') continue
    const item = renglon.get(promo.productoId)
    const cantidad = libres.get(promo.productoId) ?? 0
    if (!item || cantidad <= 0) continue
    if (promo.tipo === 'nxm') {
      const veces = Math.floor(cantidad / promo.lleva)
      if (veces <= 0) continue
      const ahorro = veces * (promo.lleva - promo.paga) * item.precio
      sumar(item.productoId, ahorro)
      libres.set(item.productoId, cantidad - veces * promo.lleva)
      aplicadas.push({ promo, veces, ahorro })
    } else if (cantidad >= promo.desde) {
      const ahorro = Math.round((item.precio * cantidad * promo.porcentaje) / 100)
      sumar(item.productoId, ahorro)
      libres.set(item.productoId, 0)
      aplicadas.push({ promo, veces: 1, ahorro })
    }
  }

  // Nunca dejar un renglón en cero: como mínimo un centavo por unidad.
  for (const [productoId, monto] of Object.entries(porItem)) {
    const item = renglon.get(productoId)
    if (!item) continue
    const tope = Math.max(0, Math.round(item.precio * item.cantidad) - Math.ceil(item.cantidad))
    porItem[productoId] = Math.min(monto, tope)
  }
  return { porItem, aplicadas }
}

/** "3x2", "10% desde 6" o "Combo $5.000": lo corto que va en la etiqueta. */
export function resumenPromo(promo: Promo, formatearPesos: (c: Centavos) => string): string {
  if (promo.tipo === 'nxm') return `${promo.lleva}x${promo.paga}`
  if (promo.tipo === 'cantidad') return `${promo.porcentaje}% llevando ${promo.desde} o más`
  return `Combo a ${formatearPesos(promo.precio)}`
}
