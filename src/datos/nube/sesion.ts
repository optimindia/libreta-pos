import { cliente } from './cliente'
import { db } from '@/datos/local/db'
import { nuevoId } from '@/dominio/id'
import type { UUID } from '@/dominio/tipos'

/** El almacenero no banca email y contraseña: entra con su teléfono y un PIN.
 *  Supabase autentica por teléfono real sólo con un proveedor de SMS contratado
 *  (Twilio y su costo por mensaje), así que se usa el backend de email con una
 *  dirección derivada del teléfono. El usuario nunca ve ese email.
 *  Limitación conocida: sin SMS no hay verificación del número ni recuperación
 *  del PIN olvidado — cuando haya clientes pagando, conviene el SMS de verdad. */
const DOMINIO = 'libreta.app'
const SAL = 'libreta-v1'

export interface Credenciales {
  email: string
  password: string
}

export function telefonoNormalizado(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.startsWith('54') ? digitos : `54${digitos}`
}

export function credencialesDesdeTelefono(telefono: string, pin: string): Credenciales {
  const numero = telefonoNormalizado(telefono)
  return {
    email: `${numero}@${DOMINIO}`,
    // La contraseña real es larga: el PIN corto nunca viaja solo.
    password: `${SAL}:${numero}:${pin}`,
  }
}

const PIN_OBVIOS = new Set([
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
])

export function validarPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false
  return !PIN_OBVIOS.has(pin)
}

/** Crea la cuenta si no existe y deja al negocio local vinculado al de la nube. */
export async function crearRespaldo(
  telefono: string,
  pin: string,
): Promise<{ ok: true; negocioId: UUID } | { ok: false; motivo: string }> {
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

  const yaVinculado = await cliente
    .from('usuarios_negocio')
    .select('negocio_id')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (yaVinculado.data?.negocio_id) {
    const negocioId = yaVinculado.data.negocio_id as UUID
    await guardarNegocioLocal(negocioId, telefono)
    return { ok: true, negocioId }
  }

  const local = await db.negocio.get('unico')
  const negocioId = nuevoId()
  const creado = await cliente.from('negocios').insert({
    id: negocioId,
    nombre: local?.nombre?.trim() || 'Mi almacén',
    logo: local?.logo ?? null,
    color: local?.color ?? null,
  })
  if (creado.error) return { ok: false, motivo: 'no se pudo crear el negocio' }

  const vinculo = await cliente
    .from('usuarios_negocio')
    .insert({ usuario_id: usuarioId, negocio_id: negocioId })
  if (vinculo.error) return { ok: false, motivo: 'no se pudo vincular el negocio' }

  await guardarNegocioLocal(negocioId, telefono)
  return { ok: true, negocioId }
}

async function guardarNegocioLocal(negocioId: UUID, telefono: string): Promise<void> {
  const actual = await db.negocio.get('unico')
  await db.negocio.put({
    id: 'unico',
    nombre: actual?.nombre ?? 'Mi almacén',
    logo: actual?.logo ?? null,
    color: actual?.color ?? null,
    negocioId,
    telefono: telefonoNormalizado(telefono),
  })
}

/** El id del negocio en la nube, o null si todavía no hay respaldo. */
export async function negocioDeLaNube(): Promise<UUID | null> {
  const negocio = await db.negocio.get('unico')
  return negocio?.negocioId ?? null
}
