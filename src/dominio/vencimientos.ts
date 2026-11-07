import type { Producto } from './tipos'

export type EstadoVence = 'vencido' | 'hoy' | 'pronto' | 'lejos'

/** Cuántos días antes se empieza a avisar. */
export const DIAS_AVISO = 7

const DIA = 86_400_000

function inicioDelDia(epoch: number): number {
  const fecha = new Date(epoch)
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()
}

/** Días hasta el vencimiento (negativo si ya venció), o null sin fecha. */
export function diasParaVencer(producto: Pick<Producto, 'venceEl'>, ahora: number): number | null {
  if (typeof producto.venceEl !== 'number' || !Number.isFinite(producto.venceEl)) return null
  return Math.round((inicioDelDia(producto.venceEl) - inicioDelDia(ahora)) / DIA)
}

export function estadoVence(producto: Pick<Producto, 'venceEl'>, ahora: number): EstadoVence | null {
  const dias = diasParaVencer(producto, ahora)
  if (dias === null) return null
  if (dias < 0) return 'vencido'
  if (dias === 0) return 'hoy'
  if (dias <= DIAS_AVISO) return 'pronto'
  return 'lejos'
}

export function textoVence(dias: number): string {
  if (dias < -1) return `Venció hace ${-dias} días`
  if (dias === -1) return 'Venció ayer'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

/** Los productos con stock que vencieron o vencen dentro del aviso, el más
 *  urgente primero. Sin stock no importa: no hay nada que sacar. */
export function porVencer(productos: Producto[], ahora: number): Array<{ producto: Producto; dias: number }> {
  return productos
    .filter((producto) => producto.stock > 0)
    .map((producto) => ({ producto, dias: diasParaVencer(producto, ahora) }))
    .filter((item): item is { producto: Producto; dias: number } => item.dias !== null && item.dias <= DIAS_AVISO)
    .sort((a, b) => a.dias - b.dias || a.producto.nombre.localeCompare(b.producto.nombre, 'es'))
}

/** La fecha de un campo <input type="date"> ("2026-11-20") al final de ese día. */
export function venceDeTexto(texto: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return undefined
  const valor = new Date(`${texto}T23:59:59`).getTime()
  return Number.isFinite(valor) ? valor : undefined
}

export function textoDeVence(epoch: number | null | undefined): string {
  if (typeof epoch !== 'number') return ''
  const fecha = new Date(epoch)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}
