import type { Cliente } from './tipos'

export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const
const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** "03-12" a partir de día y mes (1-12), o null si la fecha no existe. */
export function armarCumple(dia: number, mes: number): string | null {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null
  if (dia < 1 || dia > DIAS_POR_MES[mes - 1]) return null
  return `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function partesCumple(cumple: string | undefined | null): { dia: number; mes: number } | null {
  const partes = /^(\d{2})-(\d{2})$/.exec(cumple ?? '')
  if (!partes) return null
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  return armarCumple(dia, mes) ? { dia, mes } : null
}

/** "12 de marzo". */
export function textoCumple(cumple: string | undefined | null): string {
  const partes = partesCumple(cumple)
  return partes ? `${partes.dia} de ${MESES_LARGOS[partes.mes - 1]}` : ''
}

/** Cuántos días faltan para el próximo cumpleaños (0 = hoy). El 29 de
 *  febrero, en un año que no es bisiesto, se festeja el 28. */
export function diasHastaCumple(cumple: string | undefined | null, ahora: number): number | null {
  const partes = partesCumple(cumple)
  if (!partes) return null
  const hoy = new Date(ahora)
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const fechaEn = (anio: number) => {
    const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
    const dia = partes.mes === 2 && partes.dia === 29 && !bisiesto ? 28 : partes.dia
    return new Date(anio, partes.mes - 1, dia)
  }
  let proximo = fechaEn(hoy.getFullYear())
  if (proximo < inicioHoy) proximo = fechaEn(hoy.getFullYear() + 1)
  return Math.round((proximo.getTime() - inicioHoy.getTime()) / 86_400_000)
}

export function cuandoCumple(dias: number): string {
  if (dias === 0) return 'Cumple hoy'
  if (dias === 1) return 'Cumple mañana'
  return `Cumple en ${dias} días`
}

/** Los clientes que cumplen en los próximos `dias` días, el más cercano primero. */
export function cumplesProximos<T extends Pick<Cliente, 'cumpleanos' | 'nombre'>>(clientes: T[], ahora: number, dias = 7): Array<{ cliente: T; faltan: number }> {
  return clientes
    .map((cliente) => ({ cliente, faltan: diasHastaCumple(cliente.cumpleanos, ahora) }))
    .filter((item): item is { cliente: T; faltan: number } => item.faltan !== null && item.faltan <= dias)
    .sort((a, b) => a.faltan - b.faltan || a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'))
}

export function mensajeCumple(cliente: Pick<Cliente, 'nombre'>, negocio: string): string {
  const nombre = cliente.nombre.split(' ')[0]
  return `¡Feliz cumpleaños, ${nombre}! Que tengas un lindo día. Te saludamos de ${negocio}.`
}

/** La nota se guarda recortada y sin pasar de 500 letras; vacía = sin nota. */
export function limpiarNota(nota: string): string | undefined {
  const limpia = nota.trim().slice(0, 500)
  return limpia === '' ? undefined : limpia
}
