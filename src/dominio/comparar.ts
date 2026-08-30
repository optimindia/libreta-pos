import type { Venta } from './tipos'

const DIA_EN_MS = 24 * 60 * 60 * 1000

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Se arma a mano y no con `toLocaleDateString`: el servidor puede no tener
 *  los datos de configuración regional en español y devuelve textos rotos. */
export function fechaLarga(fecha: Date): string {
  return `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
}

function totalDelDia(ventas: Venta[], dia: Date): number {
  return ventas
    .filter((venta) => {
      const f = new Date(venta.fecha)
      return (
        f.getFullYear() === dia.getFullYear() &&
        f.getMonth() === dia.getMonth() &&
        f.getDate() === dia.getDate()
      )
    })
    .reduce((total, venta) => total + venta.total, 0)
}

/** El número solo no dice nada; comparado con el mismo día de la semana
 *  pasada, sí. Un sábado se compara con un sábado, no con un martes. */
export function compararConLaSemanaPasada(ventas: Venta[], dia: Date): number | null {
  const semanaPasada = new Date(dia.getTime() - 7 * DIA_EN_MS)
  const referencia = totalDelDia(ventas, semanaPasada)
  if (referencia === 0) return null
  const hoy = totalDelDia(ventas, dia)
  return Math.round(((hoy - referencia) / referencia) * 100)
}

export function textoDuracion(diasRestantes: number | null): string {
  if (diasRestantes === null) return 'está por debajo del mínimo'
  if (diasRestantes === 0) return 'ya no te queda'
  return `te dura ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`
}
