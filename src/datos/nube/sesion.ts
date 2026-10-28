import { cliente } from './cliente'
import { db } from '@/datos/local/db'
import { encolar } from '@/datos/local/cola'
import type { UUID } from '@/dominio/tipos'
import { accesoSaasObligatorio, notificarCambioAcceso } from './acceso'
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
    suscripcionEstado: base?.suscripcionEstado,
    suscripcionTipo: base?.suscripcionTipo,
    suscripcionVenceEn: base?.suscripcionVenceEn,
    suscripcionGraciaHasta: base?.suscripcionGraciaHasta,
    suscripcionActualizadaEn: base?.suscripcionActualizadaEn,
    ultimaBajada: base?.ultimaBajada,
  })

  // Las funciones se guardan separadas de la ficha administrativa. Si el
  // negocio era local y se acaba de vincular, su configuración viaja con él.
  const preferencias = await db.preferencias.get('unico')
  if (preferencias && preferencias.actualizadoEn > 0) {
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

/** Entrar en un aparato nuevo con el teléfono y el PIN del dueño.
 *  No crea nada: sólo trae el negocio que ya tiene en la nube. */
export async function entrar(
  telefono: string,
  pin: string,
): Promise<{ ok: true; negocioId: UUID } | { ok: false; motivo: string }> {
  if (!cliente) return { ok: false, motivo: 'la nube no está configurada' }

  const ingreso = await cliente.auth.signInWithPassword(
    credencialesDesdeTelefono(telefono, pin),
  )
  if (ingreso.error) {
    return { ok: false, motivo: 'ese teléfono y PIN no coinciden con ningún negocio' }
  }
  const usuarioId = ingreso.data.user?.id
  if (!usuarioId) return { ok: false, motivo: 'no se pudo iniciar sesión' }

  const negocioId = await vincularNegocioLocal(usuarioId, telefono)
  if (!negocioId) return { ok: false, motivo: 'esa cuenta no tiene un negocio asociado' }
  notificarCambioAcceso()
  return { ok: true, negocioId }
}

/** Cierra la sesión y elimina la copia local sensible del aparato. */
export async function cerrarSesion(): Promise<void> {
  try {
    await cliente?.auth.signOut()
  } finally {
    await limpiarDatosLocales()
    notificarCambioAcceso()
  }
}

/** El id del negocio en la nube, o null si todavía no hay respaldo. */
export async function negocioDeLaNube(): Promise<UUID | null> {
  const negocio = await db.negocio.get('unico')
  return negocio?.negocioId ?? null
}
