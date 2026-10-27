import type { EstadoSuscripcion, TipoSuscripcion, UUID } from './tipos'

export interface Suscripcion {
  id: UUID
  negocioId: UUID
  planId?: UUID | null
  planNombre?: string | null
  importeCentavos?: number
  estado: EstadoSuscripcion
  tipo: TipoSuscripcion
  inicioEn: number
  venceEn: number
  graciaHasta?: number | null
  nota?: string | null
  actualizadoEn?: number
}

export type EstadoSuscripcionEfectivo = EstadoSuscripcion | 'vencida' | 'sin_suscripcion'

export function estadoSuscripcion(
  suscripcion: Suscripcion | null | undefined,
  ahora = Date.now(),
): EstadoSuscripcionEfectivo {
  if (!suscripcion) return 'sin_suscripcion'
  if (suscripcion.estado === 'suspendida') return 'suspendida'
  // La fecha de vencimiento es la autoridad comercial. La gracia histórica
  // se conserva para trazabilidad, pero nunca extiende el acceso al POS.
  if (suscripcion.venceEn <= ahora) return 'vencida'
  return suscripcion.estado
}

export function accesoPermitido(
  suscripcion: Suscripcion | null | undefined,
  ahora = Date.now(),
): boolean {
  if (!suscripcion) return false
  const estado = estadoSuscripcion(suscripcion, ahora)
  // Sólo una prueba o suscripción activa y todavía vigente puede operar.
  // Mantener esta regla en el dominio evita que una pantalla olvide validar
  // la fecha y convierte gracia, suspensión y vencimiento en bloqueo.
  return suscripcion.venceEn > ahora && (estado === 'prueba' || estado === 'activa')
}

export function diasRestantes(
  suscripcion: Suscripcion | null | undefined,
  ahora = Date.now(),
): number {
  if (!suscripcion) return 0
  return Math.max(0, Math.ceil((suscripcion.venceEn - ahora) / 86_400_000))
}

export function fechaSuscripcion(fecha: number | null | undefined): string {
  if (!fecha) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(fecha))
}

export function textoEstadoSuscripcion(
  suscripcion: Suscripcion | null | undefined,
  ahora = Date.now(),
): string {
  switch (estadoSuscripcion(suscripcion, ahora)) {
    case 'prueba': return 'Prueba gratuita'
    case 'activa': return 'Activa'
    case 'gracia': return 'Período de gracia'
    case 'suspendida': return 'Suspendida'
    case 'vencida': return 'Vencida'
    default: return 'Sin activar'
  }
}
