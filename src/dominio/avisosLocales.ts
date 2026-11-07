import type { Centavos } from './tipos'

/** Los avisos que el celu muestra solo (sin servidor): cada uno una vez por
 *  día, y sólo si hay algo que hacer. */
export type IdAviso = 'vencen' | 'fiados' | 'caja' | 'reponer' | 'cumples'

export interface AvisoLocal {
  id: IdAviso
  titulo: string
  cuerpo: string
  url: string
}

export interface DatosAvisos {
  /** Productos vencidos o que vencen hoy/mañana. */
  porVencer: string[]
  fiadosVencidos: { cantidad: number; total: Centavos }
  /** Hubo ventas hoy y la caja del día no se cerró. */
  cajaAbierta: boolean
  reponer: string[]
  cumpleHoy: string[]
}

/** A partir de esta hora se recuerda cerrar la caja. */
export const HORA_CAJA = 20

export function claveDia(ahora: number): string {
  const fecha = new Date(ahora)
  return `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${fecha.getDate()}`
}

function lista(nombres: string[], maximo = 3): string {
  const primeros = nombres.slice(0, maximo).join(', ')
  return nombres.length > maximo ? `${primeros} y ${nombres.length - maximo} más` : primeros
}

/** Qué avisar ahora. `yaAvisados` son los ids avisados hoy (no se repiten). */
export function avisosPendientes(datos: DatosAvisos, ahora: number, yaAvisados: Set<IdAviso>, formatearPesos: (c: Centavos) => string): AvisoLocal[] {
  const hora = new Date(ahora).getHours()
  const avisos: AvisoLocal[] = []
  if (datos.porVencer.length > 0) {
    avisos.push({ id: 'vencen', titulo: datos.porVencer.length === 1 ? 'Un producto vence' : `${datos.porVencer.length} productos vencen`, cuerpo: `${lista(datos.porVencer)}. Sacalos o ponelos en oferta.`, url: '/stock' })
  }
  if (datos.fiadosVencidos.cantidad > 0) {
    avisos.push({ id: 'fiados', titulo: `Fiados vencidos: ${formatearPesos(datos.fiadosVencidos.total)}`, cuerpo: `${datos.fiadosVencidos.cantidad} ${datos.fiadosVencidos.cantidad === 1 ? 'cliente debe' : 'clientes deben'} de hace tiempo. Avisales en un toque.`, url: '/fiados' })
  }
  if (datos.cumpleHoy.length > 0) {
    avisos.push({ id: 'cumples', titulo: `Hoy cumple ${lista(datos.cumpleHoy, 2)}`, cuerpo: 'Mandale un saludo: es un lindo detalle.', url: '/' })
  }
  if (datos.reponer.length > 0 && hora >= 9) {
    avisos.push({ id: 'reponer', titulo: 'Hay que reponer', cuerpo: `${lista(datos.reponer)} llegaron al mínimo.`, url: '/stock' })
  }
  if (datos.cajaAbierta && hora >= HORA_CAJA) {
    avisos.push({ id: 'caja', titulo: 'No te olvides de cerrar la caja', cuerpo: 'Contá el efectivo y Libreta te dice si cuadra.', url: '/plata' })
  }
  return avisos.filter((aviso) => !yaAvisados.has(aviso.id))
}
