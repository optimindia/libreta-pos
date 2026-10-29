// Lógica del ingreso con teléfono + PIN, separada de Supabase y de Deno para
// poder probarla. La función `ingresar` le inyecta el almacén (tabla
// `intentos_ingreso`), la llamada a Auth y la verificación humana.

import { emailDeTelefono, passwordV1, passwordV2, telefonoNormalizado } from './credenciales.ts'
import { esperaBloqueo, sumarIntento, type EstadoIntentos, type EstadoNuevo } from './limiteIngreso.ts'

export interface AlmacenIntentos {
  leer(telefono: string): Promise<EstadoIntentos | null>
  /** Escribe `nuevo` sólo si la fila sigue como `previo` (misma versión, o
   *  ausente si `previo` es null). Devuelve false si alguien ganó de mano. */
  guardar(telefono: string, previo: EstadoIntentos | null, nuevo: EstadoNuevo): Promise<boolean>
  limpiar(telefono: string): Promise<void>
}

export interface SesionAuth {
  access_token: string
  refresh_token: string
  [otro: string]: unknown
}

export type ResultadoAuth =
  | { tipo: 'ok'; usuarioId: string; sesion: SesionAuth }
  | { tipo: 'rechazado' }
  | { tipo: 'error' }

export interface DependenciasIngreso {
  almacen: AlmacenIntentos
  autenticar(email: string, password: string): Promise<ResultadoAuth>
  cambiarPassword(usuarioId: string, password: string): Promise<void>
  /** Secreto del servidor. Sin él se usa la contraseña v1. */
  pepper?: string
  /** Si está, el pedido tiene que traer un token humano válido. */
  verificarCaptcha?: (token: string) => Promise<boolean>
  ahora?: () => number
}

export interface RespuestaIngreso {
  status: number
  cuerpo: Record<string, unknown>
}

const INTENTOS_DE_ESCRITURA = 8

const CREDENCIALES: RespuestaIngreso = { status: 401, cuerpo: { ok: false, error: 'credenciales' } }
const SERVICIO: RespuestaIngreso = { status: 503, cuerpo: { ok: false, error: 'servicio' } }
const VERIFICACION: RespuestaIngreso = { status: 400, cuerpo: { ok: false, error: 'verificacion' } }

function bloqueado(esperaMs: number): RespuestaIngreso {
  return { status: 429, cuerpo: { ok: false, error: 'bloqueado', reintentarEnSegundos: Math.ceil(esperaMs / 1000) } }
}

function leerEntrada(entrada: unknown): { numero: string; pin: string; captchaToken: string } | null {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null
  const { telefono, pin, captchaToken } = entrada as Record<string, unknown>
  if (typeof telefono !== 'string' || telefono.length > 40) return null
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return null
  const numero = telefonoNormalizado(telefono)
  if (numero.length < 10 || numero.length > 15) return null
  return { numero, pin, captchaToken: typeof captchaToken === 'string' ? captchaToken.slice(0, 4096) : '' }
}

/** Reserva un intento para la clave (un teléfono, o `reset:<usuario>` y
 *  similares en la recuperación del PIN). Devuelve la espera si está bloqueada. */
export async function reservarIntento(almacen: AlmacenIntentos, numero: string, ahora: number): Promise<number> {
  for (let vuelta = 0; vuelta < INTENTOS_DE_ESCRITURA; vuelta++) {
    const previo = await almacen.leer(numero)
    const espera = esperaBloqueo(previo, ahora)
    if (espera > 0) return espera
    if (await almacen.guardar(numero, previo, sumarIntento(previo, ahora))) return 0
  }
  // Mucha competencia por el mismo teléfono: es un ataque, no una persona.
  return 60_000
}

export async function procesarIngreso(entrada: unknown, deps: DependenciasIngreso): Promise<RespuestaIngreso> {
  const datos = leerEntrada(entrada)
  // Un pedido mal formado nunca podría entrar: no se cuenta ni se le pregunta
  // a Auth, y la respuesta es la misma que con un PIN equivocado.
  if (!datos) return CREDENCIALES

  if (deps.verificarCaptcha) {
    // Antes de contar: sin resolver el captcha no se pueden quemar los
    // intentos de un teléfono ajeno para dejarlo afuera.
    if (!datos.captchaToken || !(await deps.verificarCaptcha(datos.captchaToken))) return VERIFICACION
  }

  const ahora = deps.ahora?.() ?? Date.now()
  const espera = await reservarIntento(deps.almacen, datos.numero, ahora)
  if (espera > 0) return bloqueado(espera)

  const email = emailDeTelefono(datos.numero)
  let resultado: ResultadoAuth
  if (deps.pepper) {
    const v2 = await passwordV2(datos.numero, datos.pin, deps.pepper)
    resultado = await deps.autenticar(email, v2)
    if (resultado.tipo === 'rechazado') {
      // Cuenta creada antes del secreto: si entra con v1, se pasa a v2 y
      // desde ahí la contraseña ya no se puede calcular desde afuera.
      resultado = await deps.autenticar(email, passwordV1(datos.numero, datos.pin))
      if (resultado.tipo === 'ok') {
        try {
          await deps.cambiarPassword(resultado.usuarioId, v2)
        } catch {
          // Se reintenta en el próximo ingreso; no se le niega la entrada.
        }
      }
    }
  } else {
    resultado = await deps.autenticar(email, passwordV1(datos.numero, datos.pin))
  }

  if (resultado.tipo === 'error') return SERVICIO
  if (resultado.tipo === 'rechazado') {
    const despues = esperaBloqueo(await deps.almacen.leer(datos.numero), ahora)
    return despues > 0 ? bloqueado(despues) : CREDENCIALES
  }

  await deps.almacen.limpiar(datos.numero)
  return { status: 200, cuerpo: { ok: true, sesion: resultado.sesion } }
}
