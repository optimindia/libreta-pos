'use client'

import { db } from '@/datos/local/db'
import type { EstadoSuscripcion, Negocio, UUID } from '@/dominio/tipos'
import type { Suscripcion } from '@/dominio/suscripcion'
import { limpiarDatosLocales } from '@/datos/local/limpiar'
import { cliente, nubeActiva } from './cliente'
import { rolDe } from '@/dominio/roles'

export const EVENTO_ACCESO = 'libreta:acceso'

export interface EstadoAcceso {
  autenticado: boolean
  usuarioId: UUID | null
  negocio: Negocio | null
  suscripcion: Suscripcion | null
  online: boolean
  /** Sólo es true cuando la identidad, el negocio y la suscripción fueron
   *  leídos correctamente desde Supabase en esta comprobación. */
  verificadoRemoto: boolean
  motivoVerificacion?: 'sin_red' | 'error_red' | 'vencimiento_local'
  /** El servidor confirmó que este usuario ya no pertenece a ningún negocio
   *  (por ejemplo, el dueño lo quitó) y la copia local fue borrada. */
  motivoSinNegocio?: 'vendedor_quitado'
}

const CLAVE_AVISO_BAJA = 'libreta:aviso-baja'

function avisoBajaPendiente(usuarioId: UUID): boolean {
  try { return localStorage.getItem(CLAVE_AVISO_BAJA) === usuarioId } catch { return false }
}

function marcarAvisoBaja(usuarioId: UUID | null): void {
  try {
    if (usuarioId) localStorage.setItem(CLAVE_AVISO_BAJA, usuarioId)
    else localStorage.removeItem(CLAVE_AVISO_BAJA)
  } catch { /* sin almacenamiento el aviso sólo dura esta comprobación */ }
}

/** Quita el aviso de baja (al cerrar sesión o cuando vuelve a haber negocio). */
export function olvidarAvisoBaja(): void {
  marcarAvisoBaja(null)
}

/** La obligatoriedad se enciende por defecto en producción cuando hay nube.
 *  El override falso existe sólo para correr la suite local sin cuentas reales. */
export function accesoSaasObligatorio(): boolean {
  const configurado = process.env.NEXT_PUBLIC_SAAS_REQUIRED
  // En producción se falla cerrado: una variable mal configurada o una nube
  // ausente no puede convertir la versión comercial en un POS gratis.
  if (process.env.NODE_ENV === 'production') return true
  if (configurado === 'true') return true
  if (configurado === 'false') return false
  return nubeActiva()
}

export function notificarCambioAcceso(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ACCESO))
}

function hayRed(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

function numeroFecha(valor: unknown): number | undefined {
  if (typeof valor === 'number') return valor
  if (typeof valor === 'string') {
    const fecha = new Date(valor).getTime()
    return Number.isFinite(fecha) ? fecha : undefined
  }
  return undefined
}

function esEstadoSuscripcion(valor: unknown): valor is EstadoSuscripcion {
  return valor === 'prueba' || valor === 'activa' || valor === 'gracia' || valor === 'suspendida'
}

function esTipoSuscripcion(valor: unknown): Suscripcion['tipo'] {
  return valor === 'prueba' || valor === 'mensual' || valor === 'cortesia' || valor === 'manual'
    ? valor
    : 'manual'
}

function mapearSuscripcion(fila: Record<string, unknown> | null): Suscripcion | null {
  if (!fila || !esEstadoSuscripcion(fila.estado)) return null
  const inicioEn = numeroFecha(fila.inicio_en)
  const venceEn = numeroFecha(fila.vence_en)
  if (!inicioEn || !venceEn || typeof fila.id !== 'string' || typeof fila.negocio_id !== 'string') return null
  return {
    id: fila.id,
    negocioId: fila.negocio_id,
    planId: typeof fila.plan_id === 'string' ? fila.plan_id as UUID : null,
    planNombre: typeof fila.plan_nombre === 'string' ? fila.plan_nombre : null,
    importeCentavos: typeof fila.importe_centavos === 'number' ? fila.importe_centavos : Number(fila.importe_centavos ?? 0),
    estado: fila.estado,
    tipo: esTipoSuscripcion(fila.tipo),
    inicioEn,
    venceEn,
    graciaHasta: numeroFecha(fila.gracia_hasta) ?? null,
    nota: typeof fila.nota === 'string' ? fila.nota : null,
    actualizadoEn: numeroFecha(fila.actualizado_en),
  }
}

function suscripcionLocal(negocio: Negocio | undefined): Suscripcion | null {
  if (!negocio?.negocioId || !negocio.suscripcionEstado || !negocio.suscripcionVenceEn) return null
  return {
    id: `local-${negocio.negocioId}`,
    negocioId: negocio.negocioId,
    estado: negocio.suscripcionEstado,
    tipo: negocio.suscripcionTipo ?? 'manual',
    inicioEn: negocio.suscripcionActualizadaEn ?? Date.now(),
    venceEn: negocio.suscripcionVenceEn,
    graciaHasta: negocio.suscripcionGraciaHasta ?? null,
    actualizadoEn: negocio.suscripcionActualizadaEn,
  }
}

async function guardarAccesoLocal(
  base: Negocio | undefined,
  usuarioId: UUID,
  negocioId: UUID,
  remoto: Record<string, unknown> | null,
  suscripcion: Suscripcion | null,
  vinculo: { rol?: unknown; nombre?: unknown } = {},
): Promise<Negocio> {
  // Si este aparato cambió el nombre, logo o color y todavía no subió, se
  // conserva lo local: si no, la verificación lo pisaría con lo viejo.
  const editadoAca = (await db.cola.toArray()).some((item) => item.entidad === 'negocio' && !item.rechazado)
  const deLaNube = remoto && !editadoAca
  const negocio: Negocio = {
    id: 'unico',
    nombre: deLaNube && typeof remoto.nombre === 'string' ? remoto.nombre : (base?.nombre ?? 'Mi almacén'),
    logo: deLaNube ? ((remoto.logo as string | null | undefined) ?? null) : (base?.logo ?? null),
    color: deLaNube ? ((remoto.color as string | null | undefined) ?? null) : (base?.color ?? null),
    negocioId,
    telefono: base?.telefono,
    usuarioId,
    rol: rolDe(vinculo.rol),
    nombreUsuario: typeof vinculo.nombre === 'string' ? vinculo.nombre : null,
    verificadoEn: Date.now(),
    ultimaBajada: base?.ultimaBajada,
    suscripcionEstado: suscripcion?.estado,
    suscripcionTipo: suscripcion?.tipo,
    suscripcionVenceEn: suscripcion?.venceEn,
    suscripcionGraciaHasta: suscripcion?.graciaHasta ?? undefined,
    suscripcionActualizadaEn: suscripcion?.actualizadoEn,
  }
  await db.negocio.put(negocio)
  return negocio
}

/** Sólo se llama cuando Supabase respondió bien y dijo que no hay negocio
 *  visible: nunca por un fallo de red. Si este aparato tenía la copia de un
 *  negocio, ya no corresponde (vendedor quitado): se borra y se avisa. */
async function estadoSinNegocio(usuarioId: UUID, online: boolean, cache: Negocio | undefined): Promise<EstadoAcceso> {
  if (cache?.negocioId) {
    await limpiarDatosLocales()
    marcarAvisoBaja(usuarioId)
  }
  return {
    autenticado: true, usuarioId, negocio: null, suscripcion: null, online, verificadoRemoto: true,
    motivoSinNegocio: avisoBajaPendiente(usuarioId) ? 'vendedor_quitado' : undefined,
  }
}

function estadoSinVerificar(
  usuarioId: UUID,
  cache: Negocio | undefined,
  online: boolean,
  motivoVerificacion: 'sin_red' | 'error_red',
): EstadoAcceso {
  const cacheValida = cache?.usuarioId === usuarioId && Boolean(cache.negocioId)
  return {
    autenticado: true,
    usuarioId,
    negocio: cacheValida ? cache ?? null : null,
    suscripcion: cacheValida ? suscripcionLocal(cache) : null,
    online,
    verificadoRemoto: false,
    motivoVerificacion,
  }
}

/** Obtiene la identidad real, su negocio y el entitlement manual. Si no hay
 *  señal, usa sólo la copia cacheada que pertenece al mismo usuario. */
export async function cargarEstadoAcceso(): Promise<EstadoAcceso> {
  const online = hayRed()
  if (!cliente) return { autenticado: false, usuarioId: null, negocio: null, suscripcion: null, online, verificadoRemoto: false }

  // Renovar un token vencido sin señal (o con señal mala) reintenta con esperas
  // cada vez más largas: no se espera a Supabase, se sigue con el usuario de
  // este aparato.
  const cacheLocal = await db.negocio.get('unico')
  let sesion
  try {
    const pedida = cliente.auth.getSession()
    if (cacheLocal?.usuarioId && cacheLocal.negocioId) {
      const limite = new Promise<null>((resolver) => { setTimeout(() => resolver(null), 2500) })
      const primera = await Promise.race([pedida, limite])
      if (!primera) {
        pedida.catch(() => undefined)
        return estadoSinVerificar(cacheLocal.usuarioId, cacheLocal, online, online ? 'error_red' : 'sin_red')
      }
      sesion = primera
    } else {
      sesion = await pedida
    }
  } catch {
    return { autenticado: false, usuarioId: null, negocio: null, suscripcion: null, online, verificadoRemoto: false, motivoVerificacion: 'error_red' }
  }
  const usuarioId = sesion.data.session?.user?.id as UUID | undefined
  const cache = await db.negocio.get('unico')
  if (!usuarioId) {
    // Con el token vencido y sin red, Supabase no puede renovarlo y no
    // devuelve sesión: no es un cierre de sesión. Se sigue con el usuario
    // de este aparato hasta que vuelva la señal.
    if ((!online || sesion.error?.name === 'AuthRetryableFetchError') && cache?.usuarioId && cache.negocioId) {
      return estadoSinVerificar(cache.usuarioId, cache, online, online ? 'error_red' : 'sin_red')
    }
    return { autenticado: false, usuarioId: null, negocio: null, suscripcion: null, online, verificadoRemoto: online }
  }

  // La copia local sirve para pintar el motivo del bloqueo, nunca para
  // conceder acceso comercial sin una comprobación fresca del servidor.
  if (!online) return estadoSinVerificar(usuarioId, cache, online, 'sin_red')

  try {
    const vinculo = await cliente
      .from('usuarios_negocio')
      .select('negocio_id,rol,nombre')
      .eq('usuario_id', usuarioId)
      .maybeSingle()
    if (vinculo.error) throw vinculo.error
    const negocioId = vinculo.data?.negocio_id as UUID | undefined
    if (!negocioId) return await estadoSinNegocio(usuarioId, online, cache)

    const [negocioRemoto, suscripcionRemota] = await Promise.all([
      cliente.from('negocios').select('id,nombre,logo,color').eq('id', negocioId).maybeSingle(),
      // No enviamos al navegador notas internas; el nombre/precio del plan sí
      // son datos comerciales propios que la cuenta puede consultar.
      cliente.from('suscripciones').select('id,negocio_id,plan_id,plan_nombre,importe_centavos,estado,tipo,inicio_en,vence_en,actualizado_en').eq('negocio_id', negocioId).maybeSingle(),
    ])
    if (negocioRemoto.error) throw negocioRemoto.error
    if (suscripcionRemota.error) throw suscripcionRemota.error
    // La identidad no recibe acceso ni siquiera desde la caché si el negocio
    // dejó de estar visible en Supabase (por ejemplo, fue desactivado o
    // revocado). La copia local sólo sirve para explicar un bloqueo.
    if (!negocioRemoto.data) return await estadoSinNegocio(usuarioId, online, cache)
    const suscripcion = mapearSuscripcion((suscripcionRemota.data as Record<string, unknown> | null) ?? null)
    const negocio = await guardarAccesoLocal(
      cache,
      usuarioId,
      negocioId,
      (negocioRemoto.data as Record<string, unknown> | null) ?? null,
      suscripcion,
      (vinculo.data as { rol?: unknown; nombre?: unknown } | null) ?? {},
    )
    marcarAvisoBaja(null)
    return { autenticado: true, usuarioId, negocio, suscripcion, online, verificadoRemoto: true }
  } catch {
    return estadoSinVerificar(usuarioId, cache, online, 'error_red')
  }
}
