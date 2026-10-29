import { cliente } from './cliente'

/** PIN y recuperación (SEG-04). El navegador no decide nada: pide, y la
 *  función Edge verifica la sesión, el rol y el negocio. Nada de lo que viaja
 *  por acá (PIN, PIN temporal, código) se guarda ni se escribe en consola. */

export interface VendedorPinPendiente {
  usuarioId: string
  nombre: string | null
  telefono: string | null
  /** Todavía no cambió el PIN temporal. */
  pendiente: boolean
}

export interface EstadoPin {
  rol: 'dueno' | 'vendedor'
  debeCambiarPin: boolean
  /** Sólo el dueño: si ya tiene un código de recuperación vigente. */
  tieneCodigo?: boolean
  /** Sólo el dueño. */
  vendedores?: VendedorPinPendiente[]
}

export type ResultadoPin<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; bloqueado?: boolean; reintentarEnSegundos?: number }

const ERROR_GENERICO = 'No se pudo completar la operación. Probá de nuevo en un rato.'
const ERROR_RED = 'No se pudo conectar. Revisá la señal y probá de nuevo.'

async function leerRespuesta<T>(respuesta: Response): Promise<ResultadoPin<T>> {
  let cuerpo: Record<string, unknown> | null = null
  try {
    cuerpo = (await respuesta.json()) as Record<string, unknown>
  } catch {
    // Una respuesta que no es JSON se trata abajo como error genérico.
  }
  if (cuerpo?.ok === true) return cuerpo as ResultadoPin<T>
  const error = typeof cuerpo?.error === 'string' && cuerpo.motivo ? cuerpo.error : ERROR_GENERICO
  const espera = Number(cuerpo?.reintentarEnSegundos)
  return {
    ok: false,
    error,
    ...(cuerpo?.motivo === 'bloqueado' ? { bloqueado: true } : {}),
    ...(Number.isFinite(espera) && espera > 0 ? { reintentarEnSegundos: espera } : {}),
  }
}

async function conSesion<T>(cuerpo: Record<string, unknown>): Promise<ResultadoPin<T>> {
  if (!cliente) return { ok: false, error: 'La nube no está configurada.' }
  const sesion = await cliente.auth.getSession()
  const token = sesion.data.session?.access_token
  if (!token) return { ok: false, error: 'Hay que iniciar sesión.' }
  try {
    const respuesta = await fetch('/api/admin', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion: 'pin', ...cuerpo }),
    })
    return await leerRespuesta<T>(respuesta)
  } catch {
    return { ok: false, error: ERROR_RED }
  }
}

export function consultarEstadoPin() {
  return conSesion<EstadoPin>({ operacion: 'estado' })
}

/** El dueño restablece el PIN de un vendedor de su negocio. El PIN temporal
 *  viene en la respuesta y no se vuelve a poder ver. */
export function restablecerPinVendedor(usuarioId: string) {
  return conSesion<{ pinTemporal: string; vendedor: { usuarioId: string; nombre: string | null } }>({
    operacion: 'reiniciar_vendedor',
    usuarioId,
  })
}

/** Código de recuperación nuevo (reemplaza al anterior). Pide el PIN actual. */
export function generarCodigoRecuperacion(pin: string) {
  return conSesion<{ codigoRecuperacion: string }>({ operacion: 'generar_codigo', pin })
}

/** Cambia el PIN propio (también el temporal). Si es el dueño, devuelve un
 *  código de recuperación nuevo. */
export function cambiarMiPin(pinActual: string, pinNuevo: string) {
  return conSesion<{ codigoRecuperacion?: string }>({ operacion: 'cambiar', pinActual, pinNuevo })
}

/** El dueño que olvidó su PIN: teléfono + código de recuperación + PIN nuevo.
 *  Va por /api/ingresar (no hay sesión todavía). Devuelve un código nuevo. */
export async function recuperarConCodigo(
  telefono: string,
  codigo: string,
  pinNuevo: string,
  captchaToken?: string,
): Promise<ResultadoPin<{ codigoRecuperacion: string }>> {
  try {
    const respuesta = await fetch('/api/ingresar', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'recuperar', telefono, codigo, pinNuevo, ...(captchaToken ? { captchaToken } : {}) }),
    })
    if (respuesta.status === 501 || respuesta.status === 404) {
      return { ok: false, error: 'La recuperación del PIN todavía no está disponible. Pedile ayuda al administrador de Libreta.' }
    }
    return await leerRespuesta<{ codigoRecuperacion: string }>(respuesta)
  } catch {
    return { ok: false, error: ERROR_RED }
  }
}

/** ¿Este usuario entró con un PIN temporal y tiene que cambiarlo? Lee su
 *  propia fila (la base sólo se la deja leer a él). Cualquier falla —sin red,
 *  sin sesión, o una base a la que todavía no se le aplicó la migración—
 *  cuenta como "no", para no dejar a nadie afuera por un error nuestro. */
export async function debeCambiarPin(): Promise<boolean> {
  try {
    if (!cliente) return false
    const sesion = await cliente.auth.getSession()
    const usuarioId = sesion.data.session?.user.id
    if (!usuarioId) return false
    const { data, error } = await cliente
      .from('usuarios_negocio')
      .select('debe_cambiar_pin')
      .eq('usuario_id', usuarioId)
      .maybeSingle()
    if (error) return false
    return data?.debe_cambiar_pin === true
  } catch {
    return false
  }
}
