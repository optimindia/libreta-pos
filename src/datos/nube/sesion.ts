import { cliente } from './cliente'
import { db } from '@/datos/local/db'
import { encolar } from '@/datos/local/cola'
import type { UUID } from '@/dominio/tipos'
import { accesoSaasObligatorio, notificarCambioAcceso, olvidarAvisoBaja } from './acceso'
import { limpiarDatosLocales } from '@/datos/local/limpiar'
import { rolDe } from '@/dominio/roles'
import { credencialesDesdeTelefono, telefonoNormalizado, validarPin, type Credenciales } from '@/dominio/credenciales'

export { credencialesDesdeTelefono, telefonoNormalizado, validarPin }
export type { Credenciales }

/** El almacenero no banca email y contraseña: entra con su teléfono y un PIN.
 *  Supabase autentica por teléfono real sólo con un proveedor de SMS contratado
 *  (Twilio y su costo por mensaje), así que se usa el backend de email con una
 *  dirección derivada del teléfono. El usuario nunca ve ese email.
 *  Limitación conocida: sin SMS no hay verificación del número ni recuperación
 *  del PIN olvidado — cuando haya clientes pagando, conviene el SMS de verdad. */
/** Crea la cuenta si no existe y deja al negocio local vinculado al de la nube. */
export async function crearRespaldo(
  telefono: string,
  pin: string,
): Promise<{ ok: true; negocioId: UUID } | { ok: false; motivo: string }> {
  if (accesoSaasObligatorio()) return { ok: false, motivo: 'El acceso a Libreta se gestiona desde una cuenta activada.' }
  if (!cliente) return { ok: false, motivo: 'la nube no está configurada' }
  if (!validarPin(pin)) return { ok: false, motivo: 'el PIN tiene que ser de 6 números, y no todos iguales' }

  const credenciales = credencialesDesdeTelefono(telefono, pin)

  const alta = await cliente.auth.signUp(credenciales)
  if (alta.error && !/already registered/i.test(alta.error.message)) {
    return { ok: false, motivo: 'no se pudo crear la cuenta' }
  }

  const ingreso = await cliente.auth.signInWithPassword(credenciales)
  if (ingreso.error) {
    return { ok: false, motivo: 'ese teléfono ya tiene otro PIN' }
  }

  const usuarioId = ingreso.data.user?.id
  if (!usuarioId) return { ok: false, motivo: 'no se pudo iniciar sesión' }

  const yaVinculado = await vincularNegocioLocal(usuarioId, telefono)
  if (yaVinculado) return { ok: true, negocioId: yaVinculado }

  // El alta va por una función de la base: crear el negocio y vincularlo al
  // usuario tiene que pasar junto, y el RLS no deja insertar un negocio que
  // todavía no es de nadie.
  const local = await db.negocio.get('unico')
  const creado = await cliente.rpc('crear_mi_negocio', {
    p_nombre: local?.nombre?.trim() || 'Mi almacén',
    p_logo: local?.logo ?? null,
    p_color: local?.color ?? null,
  })
  if (creado.error || !creado.data) {
    return { ok: false, motivo: 'no se pudo crear el negocio' }
  }

  const negocioId = creado.data as UUID
  await guardarNegocioLocal(negocioId, telefono, usuarioId)
  notificarCambioAcceso()
  return { ok: true, negocioId }
}

async function guardarNegocioLocal(
  negocioId: UUID,
  telefono: string,
  usuarioId: UUID,
  vinculo: { rol?: unknown; nombre?: unknown } = {},
): Promise<void> {
  const actual = await db.negocio.get('unico')
  if (actual?.negocioId && actual.usuarioId !== usuarioId) {
    await limpiarDatosLocales()
  }
  const base = await db.negocio.get('unico')
  await db.negocio.put({
    id: 'unico',
    nombre: base?.nombre ?? 'Mi almacén',
    logo: base?.logo ?? null,
    color: base?.color ?? null,
    negocioId,
    telefono: telefonoNormalizado(telefono),
    usuarioId,
    rol: rolDe(vinculo.rol),
    nombreUsuario: typeof vinculo.nombre === 'string' ? vinculo.nombre : null,
    verificadoEn: base?.verificadoEn,
    suscripcionEstado: base?.suscripcionEstado,
    suscripcionTipo: base?.suscripcionTipo,
    suscripcionVenceEn: base?.suscripcionVenceEn,
    suscripcionGraciaHasta: base?.suscripcionGraciaHasta,
    suscripcionActualizadaEn: base?.suscripcionActualizadaEn,
    ultimaBajada: base?.ultimaBajada,
  })

  // Las funciones se guardan separadas de la ficha administrativa. Si el
  // negocio era local y se acaba de vincular, su configuración viaja con él.
  // Un vendedor no las sube: Ajustes es del dueño y la base se lo rechaza.
  const preferencias = await db.preferencias.get('unico')
  if (preferencias && preferencias.actualizadoEn > 0 && rolDe(vinculo.rol) === 'dueno') {
    const vinculadas = { ...preferencias, negocioId }
    await db.preferencias.put(vinculadas)
    await encolar('preferencias', 'actualizar', vinculadas)
  }
}

/** Lee el vínculo usuario→negocio en la nube y, si existe, lo guarda
 *  localmente. Devuelve el negocioId o null. */
async function vincularNegocioLocal(
  usuarioId: string,
  telefono: string,
): Promise<UUID | null> {
  if (!cliente) return null
  const vinculo = await cliente
    .from('usuarios_negocio')
    .select('negocio_id,rol,nombre')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!vinculo.data?.negocio_id) return null
  const negocioId = vinculo.data.negocio_id as UUID
  await guardarNegocioLocal(negocioId, telefono, usuarioId as UUID, vinculo.data)
  return negocioId
}

export type ResultadoEntrar =
  | { ok: true; negocioId: UUID }
  | { ok: false; motivo: string; esperaSegundos?: number }

const MOTIVO_CREDENCIALES = 'ese teléfono y PIN no coinciden con ningún negocio'
const MOTIVO_SERVICIO = 'No se pudo validar el acceso. Probá de nuevo en un rato.'

/** "Demasiados intentos. Esperá N minutos…", redondeando siempre para arriba. */
export function motivoBloqueo(segundos: number): string {
  const minutos = Math.max(1, Math.ceil(segundos / 60))
  return `Demasiados intentos. Esperá ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} y probá de nuevo.`
}

/** Entrar en un aparato nuevo con el teléfono y el PIN del dueño o vendedor.
 *  No crea nada: sólo trae el negocio que ya tiene en la nube.
 *
 *  El PIN no se prueba desde el navegador: va a /api/ingresar, que lo pasa a
 *  la función `ingresar` de Supabase. Ahí se cuentan los intentos por
 *  teléfono (5 fallos -> 15 minutos de bloqueo) y se pide la sesión a Auth.
 *  Si esa función todavía no está desplegada (501), se entra como antes. */
export async function entrar(
  telefono: string,
  pin: string,
  opciones: { captchaToken?: string } = {},
): Promise<ResultadoEntrar> {
  if (!cliente) return { ok: false, motivo: 'la nube no está configurada' }

  let respuesta: Response
  try {
    respuesta = await fetch('/api/ingresar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(opciones.captchaToken ? { telefono, pin, captchaToken: opciones.captchaToken } : { telefono, pin }),
    })
  } catch {
    return { ok: false, motivo: 'No se pudo validar el acceso. Revisá la señal y probá de nuevo.' }
  }

  let usuarioId: string | undefined
  if (respuesta.status === 501 || respuesta.status === 404) {
    // Servidor de ingreso sin desplegar: mismo camino que antes del cambio.
    const ingreso = await cliente.auth.signInWithPassword(credencialesDesdeTelefono(telefono, pin))
    if (ingreso.error) return { ok: false, motivo: MOTIVO_CREDENCIALES }
    usuarioId = ingreso.data.user?.id
  } else {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      reintentarEnSegundos?: number
      sesion?: { access_token?: string; refresh_token?: string }
    } | null
    if (respuesta.status === 429 || cuerpo?.error === 'bloqueado') {
      const espera = Number(cuerpo?.reintentarEnSegundos)
      const esperaSegundos = Number.isFinite(espera) && espera > 0 ? espera : 15 * 60
      return { ok: false, motivo: motivoBloqueo(esperaSegundos), esperaSegundos }
    }
    if (cuerpo?.error === 'verificacion') {
      return { ok: false, motivo: 'Completá la verificación de seguridad y probá de nuevo.' }
    }
    if (respuesta.status === 401 || cuerpo?.error === 'credenciales') {
      return { ok: false, motivo: MOTIVO_CREDENCIALES }
    }
    const sesion = cuerpo?.sesion
    if (!respuesta.ok || !cuerpo?.ok || !sesion?.access_token || !sesion.refresh_token) {
      return { ok: false, motivo: MOTIVO_SERVICIO }
    }
    const guardada = await cliente.auth.setSession({ access_token: sesion.access_token, refresh_token: sesion.refresh_token })
    if (guardada.error) return { ok: false, motivo: MOTIVO_SERVICIO }
    usuarioId = guardada.data.user?.id
  }
  if (!usuarioId) return { ok: false, motivo: 'no se pudo iniciar sesión' }

  const negocioId = await vincularNegocioLocal(usuarioId, telefono)
  if (!negocioId) return { ok: false, motivo: 'esa cuenta no tiene un negocio asociado' }
  notificarCambioAcceso()
  return { ok: true, negocioId }
}

/** Cierra la sesión y elimina la copia local sensible del aparato. */
export async function cerrarSesion(): Promise<void> {
  try {
    // Sólo este aparato: el cierre global revoca la sesión de la PC o el
    // celular donde el mismo dueño sigue trabajando, y ese aparato deja de
    // sincronizar sin avisar.
    await cliente?.auth.signOut({ scope: 'local' })
  } finally {
    await limpiarDatosLocales()
    olvidarAvisoBaja()
    notificarCambioAcceso()
  }
}

/** El id del negocio en la nube, o null si todavía no hay respaldo. */
export async function negocioDeLaNube(): Promise<UUID | null> {
  const negocio = await db.negocio.get('unico')
  return negocio?.negocioId ?? null
}
