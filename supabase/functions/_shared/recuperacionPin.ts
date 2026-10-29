// Recuperación segura del PIN (SEG-04), separada de Supabase y de Deno para
// poder probarla. Las funciones `admin` (acciones con sesión) e `ingresar`
// (recuperación sin sesión) le inyectan la base, Auth, la auditoría y el reloj.
//
// Dos caminos, sin SMS ni correo:
//   * El DUEÑO restablece el PIN de un vendedor de su negocio: sale un PIN
//     temporal de 6 dígitos, se muestra una sola vez y el vendedor queda
//     obligado a cambiarlo en su próximo ingreso.
//   * El dueño que olvidó su PIN usa su código de recuperación: de un solo
//     uso, se guarda hasheado y se muestra una vez al crearlo o renovarlo.
//
// Regla de oro de este archivo: nada sensible sale por consola ni por la
// auditoría (ni PIN, ni código, ni hash, ni contraseña, ni teléfono completo).
// Por eso no hay ningún console.* acá y los errores de los almacenes se dejan
// subir tal cual, sin envolverlos con datos del pedido.
//
// Usa sólo Web Crypto, que existe igual en Deno y en Node.

import { emailDeTelefono, passwordParaCuenta, passwordV1, passwordV2, telefonoNormalizado } from './credenciales.ts'
import { reservarIntento, type AlmacenIntentos } from './ingreso.ts'
import { esperaBloqueo } from './limiteIngreso.ts'

export type RolPin = 'dueno' | 'vendedor'

export interface VinculoPin {
  usuarioId: string
  negocioId: string
  rol: RolPin
  nombre: string | null
}

export interface VendedorPin {
  usuarioId: string
  nombre: string | null
  telefono?: string | null
  debeCambiar: boolean
}

/** Lo único que queda en la auditoría: quién, sobre quién y qué. */
export interface EventoPin {
  negocioId: string
  actorId: string
  objetivoId: string | null
  accion: 'pin_vendedor_reiniciado' | 'pin_codigo_generado' | 'pin_cambiado' | 'pin_recuperado'
}

export interface DatosPin {
  vinculo(usuarioId: string): Promise<VinculoPin | null>
  vendedoresDe(negocioId: string): Promise<VendedorPin[]>
  /** Teléfono normalizado de la cuenta (sale del email de Auth). */
  numeroDe(usuarioId: string): Promise<string | null>
  usuarioPorNumero(numero: string): Promise<{ usuarioId: string } | null>
  autenticar(email: string, password: string): Promise<'ok' | 'rechazado' | 'error'>
  cambiarPassword(usuarioId: string, password: string): Promise<void>
  debeCambiar(usuarioId: string): Promise<boolean>
  marcarCambio(usuarioId: string, debe: boolean): Promise<void>
  hayCodigo(usuarioId: string): Promise<boolean>
  /** Reemplaza el código vigente (el anterior deja de servir). */
  guardarCodigo(usuarioId: string, hash: string): Promise<void>
  /** Atómico: marca el código como usado sólo si sigue vigente y coincide
   *  (`update ... where usado_en is null and codigo_hash = $2`). */
  consumirCodigo(usuarioId: string, hash: string): Promise<boolean>
  auditar(evento: EventoPin): Promise<void>
}

export interface DependenciasPin {
  datos: DatosPin
  almacen: AlmacenIntentos
  /** Secreto del servidor (LIBRETA_PIN_PEPPER). Sin él se usa la contraseña v1. */
  pepper?: string
  verificarCaptcha?: (token: string) => Promise<boolean>
  ahora?: () => number
  /** Bytes aleatorios; en producción, crypto.getRandomValues. */
  aleatorio?: (largo: number) => Uint8Array
}

export interface RespuestaPin {
  status: number
  cuerpo: Record<string, unknown>
}

// ---------------------------------------------------------------- reglas

const PINES_OBVIOS = new Set(['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999'])

export function pinValido(pin: string): boolean {
  return /^\d{6}$/.test(pin) && !PINES_OBVIOS.has(pin)
}

// 32 símbolos sin I, O, 0 ni 1 (no se confunden al copiarlos a mano): 16
// símbolos = 80 bits, imposible de adivinar con 5 intentos por 15 minutos.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LARGO_CODIGO = 16
const LIMITE_SORTEO = Math.floor(2 ** 32 / 1_000_000) * 1_000_000

/** PIN temporal de 6 dígitos, sorteado sin sesgo y nunca uno obvio. */
export function generarPinTemporal(deps: Pick<DependenciasPin, 'aleatorio'> = {}): string {
  for (;;) {
    const b = deps.aleatorio ? deps.aleatorio(4) : crypto.getRandomValues(new Uint8Array(4))
    const n = b[0] * 2 ** 24 + b[1] * 2 ** 16 + b[2] * 2 ** 8 + b[3]
    if (n >= LIMITE_SORTEO) continue
    const pin = String(n % 1_000_000).padStart(6, '0')
    if (pinValido(pin)) return pin
  }
}

/** XXXX-XXXX-XXXX-XXXX */
export function generarCodigoRecuperacion(deps: Pick<DependenciasPin, 'aleatorio'> = {}): string {
  const b = deps.aleatorio ? deps.aleatorio(LARGO_CODIGO) : crypto.getRandomValues(new Uint8Array(LARGO_CODIGO))
  let simbolos = ''
  for (let i = 0; i < LARGO_CODIGO; i++) simbolos += ALFABETO[b[i] & 31]
  return simbolos.match(/.{4}/g)!.join('-')
}

/** Mayúsculas y sin guiones ni espacios; null si no puede ser un código. */
export function normalizarCodigo(valor: string): string | null {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (limpio.length !== LARGO_CODIGO) return null
  for (const c of limpio) if (!ALFABETO.includes(c)) return null
  return limpio
}

async function hashCodigo(usuarioId: string, codigoNormalizado: string, pepper?: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper || 'libreta-recuperacion-v1'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`recuperacion:${usuarioId}:${codigoNormalizado}`)),
  )
  let binario = ''
  for (const byte of firma) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Genera un código nuevo, guarda sólo su hash (el anterior deja de servir) y
 *  lo devuelve para mostrarlo UNA vez. Lo usan el alta de la cuenta, el PIN
 *  regenerado desde el panel, el cambio de PIN del dueño y la recuperación. */
export async function emitirCodigoRecuperacion(usuarioId: string, deps: DependenciasPin): Promise<string> {
  const codigo = generarCodigoRecuperacion(deps)
  const normalizado = normalizarCodigo(codigo)!
  await deps.datos.guardarCodigo(usuarioId, await hashCodigo(usuarioId, normalizado, deps.pepper))
  return codigo
}

// ------------------------------------------------------------- respuestas

const MENSAJES = {
  formato: 'Revisá los datos y probá de nuevo.',
  sin_permiso: 'Sólo el dueño del negocio puede hacer esto.',
  no_encontrado: 'No encontramos a ese vendedor en tu negocio.',
  pin_incorrecto: 'El PIN actual no es correcto.',
  pin_flojo: 'El PIN nuevo tiene que ser de 6 números, no ser obvio y ser distinto del actual.',
  credenciales: 'El teléfono o el código no son correctos.',
  verificacion: 'Completá la verificación de seguridad y probá de nuevo.',
  servicio: 'No se pudo completar la operación. Probá de nuevo en un rato.',
} as const

function fallo(status: number, motivo: keyof typeof MENSAJES): RespuestaPin {
  return { status, cuerpo: { ok: false, error: MENSAJES[motivo], motivo } }
}

function bloqueado(esperaMs: number): RespuestaPin {
  const segundos = Math.ceil(esperaMs / 1000)
  const minutos = Math.max(1, Math.ceil(segundos / 60))
  return {
    status: 429,
    cuerpo: {
      ok: false,
      motivo: 'bloqueado',
      error: `Demasiados intentos. Esperá ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} y probá de nuevo.`,
      reintentarEnSegundos: segundos,
    },
  }
}

function ok(extra: Record<string, unknown> = {}): RespuestaPin {
  return { status: 200, cuerpo: { ok: true, ...extra } }
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

function cadena(valor: unknown, maximo: number): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= maximo ? valor : null
}

function reloj(deps: DependenciasPin): number {
  return deps.ahora?.() ?? Date.now()
}

/** Comprueba un PIN contra Auth, igual que el ingreso: v2 y, si la cuenta es
 *  anterior al secreto, v1. */
async function comprobarPin(numero: string, pin: string, deps: DependenciasPin): Promise<'ok' | 'rechazado' | 'error'> {
  const email = emailDeTelefono(numero)
  if (deps.pepper) {
    const v2 = await deps.datos.autenticar(email, await passwordV2(numero, pin, deps.pepper))
    if (v2 !== 'rechazado') return v2
  }
  return deps.datos.autenticar(email, passwordV1(numero, pin))
}

/** Verifica el PIN actual de quien llama, con intentos contados ANTES de
 *  probarlo (clave `pin:<usuario>`). Devuelve null si es correcto. */
async function exigirPinActual(usuarioId: string, pin: string, deps: DependenciasPin): Promise<RespuestaPin | null> {
  const clave = `pin:${usuarioId}`
  const ahora = reloj(deps)
  const espera = await reservarIntento(deps.almacen, clave, ahora)
  if (espera > 0) return bloqueado(espera)
  const numero = await deps.datos.numeroDe(usuarioId)
  if (!numero) return fallo(403, 'pin_incorrecto')
  const resultado = await comprobarPin(numero, pin, deps)
  if (resultado === 'error') return fallo(503, 'servicio')
  if (resultado === 'rechazado') {
    const despues = esperaBloqueo(await deps.almacen.leer(clave), ahora)
    return despues > 0 ? bloqueado(despues) : fallo(403, 'pin_incorrecto')
  }
  await deps.almacen.limpiar(clave)
  return null
}

// ----------------------------------------------------- acciones con sesión

/** Acciones de quien ya inició sesión. `actorId` sale del token verificado
 *  por la función, nunca del cuerpo del pedido. */
export async function procesarPinSesion(entrada: unknown, actorId: string, deps: DependenciasPin): Promise<RespuestaPin> {
  const cuerpo = objeto(entrada)
  if (!cuerpo) return fallo(400, 'formato')
  const operacion = cuerpo.operacion

  const actor = await deps.datos.vinculo(actorId)
  if (operacion !== 'estado' && operacion !== 'reiniciar_vendedor' && operacion !== 'generar_codigo' && operacion !== 'cambiar') {
    return fallo(400, 'formato')
  }
  if (!actor) return fallo(403, 'sin_permiso')

  if (operacion === 'estado') {
    const base = { rol: actor.rol, debeCambiarPin: await deps.datos.debeCambiar(actorId) }
    if (actor.rol !== 'dueno') return ok(base)
    const vendedores = await deps.datos.vendedoresDe(actor.negocioId)
    return ok({
      ...base,
      tieneCodigo: await deps.datos.hayCodigo(actorId),
      vendedores: vendedores.map((v) => ({
        usuarioId: v.usuarioId,
        nombre: v.nombre,
        telefono: v.telefono ?? null,
        pendiente: v.debeCambiar,
      })),
    })
  }

  if (operacion === 'reiniciar_vendedor') {
    const objetivoId = cadena(cuerpo.usuarioId, 80)
    if (!objetivoId) return fallo(400, 'formato')
    if (actor.rol !== 'dueno') return fallo(403, 'sin_permiso')
    const objetivo = await deps.datos.vinculo(objetivoId)
    // Otro negocio y "no existe" se responden igual: no se delata nada ajeno.
    if (!objetivo || objetivo.negocioId !== actor.negocioId) return fallo(404, 'no_encontrado')
    if (objetivo.rol !== 'vendedor') return fallo(403, 'sin_permiso')

    const espera = await reservarIntento(deps.almacen, `reset:${actorId}`, reloj(deps))
    if (espera > 0) return bloqueado(espera)

    const numero = await deps.datos.numeroDe(objetivoId)
    if (!numero) return fallo(404, 'no_encontrado')
    const pinTemporal = generarPinTemporal(deps)
    // Se audita ANTES de cambiar nada: si no se puede dejar registro, no se
    // cambia el PIN (y nunca queda un PIN temporal que el dueño no vio). Después
    // la bandera: si el cambio de contraseña falla, el vendedor sigue con su PIN
    // de siempre y, a lo sumo, se le pide cambiarlo.
    await deps.datos.auditar({ negocioId: actor.negocioId, actorId, objetivoId, accion: 'pin_vendedor_reiniciado' })
    await deps.datos.marcarCambio(objetivoId, true)
    await deps.datos.cambiarPassword(objetivoId, await passwordParaCuenta(numero, pinTemporal, deps.pepper))
    return ok({ pinTemporal, vendedor: { usuarioId: objetivoId, nombre: objetivo.nombre } })
  }

  if (operacion === 'generar_codigo') {
    const pin = cadena(cuerpo.pin, 6)
    if (!pin || !/^\d{6}$/.test(pin)) return fallo(400, 'formato')
    if (actor.rol !== 'dueno') return fallo(403, 'sin_permiso')
    const rechazo = await exigirPinActual(actorId, pin, deps)
    if (rechazo) return rechazo
    await deps.datos.auditar({ negocioId: actor.negocioId, actorId, objetivoId: actorId, accion: 'pin_codigo_generado' })
    return ok({ codigoRecuperacion: await emitirCodigoRecuperacion(actorId, deps) })
  }

  // cambiar
  const pinActual = cadena(cuerpo.pinActual, 6)
  const pinNuevo = cadena(cuerpo.pinNuevo, 6)
  if (!pinActual || !/^\d{6}$/.test(pinActual) || !pinNuevo) return fallo(400, 'formato')
  if (!pinValido(pinNuevo) || pinNuevo === pinActual) return fallo(400, 'pin_flojo')
  const rechazo = await exigirPinActual(actorId, pinActual, deps)
  if (rechazo) return rechazo
  const numero = await deps.datos.numeroDe(actorId)
  if (!numero) return fallo(503, 'servicio')
  await deps.datos.auditar({ negocioId: actor.negocioId, actorId, objetivoId: actorId, accion: 'pin_cambiado' })
  await deps.datos.cambiarPassword(actorId, await passwordParaCuenta(numero, pinNuevo, deps.pepper))
  await deps.datos.marcarCambio(actorId, false)
  // El dueño recibe un código nuevo: el anterior quedó atado al PIN viejo.
  if (actor.rol === 'dueno') return ok({ codigoRecuperacion: await emitirCodigoRecuperacion(actorId, deps) })
  return ok()
}

// ------------------------------------------------------ recuperación sin sesión

/** El dueño que olvidó su PIN: teléfono + código de un solo uso + PIN nuevo.
 *  Toda falla (teléfono inexistente, de un vendedor, código malo o ya usado)
 *  responde igual. Los intentos se cuentan por teléfono ANTES de probar el
 *  código y en una clave propia (`recuperar:<tel>`): trabarla no impide
 *  ingresar con el PIN. */
export async function procesarRecuperacion(entrada: unknown, deps: DependenciasPin): Promise<RespuestaPin> {
  const cuerpo = objeto(entrada)
  const telefono = cuerpo ? cadena(cuerpo.telefono, 40) : null
  const codigoTexto = cuerpo ? cadena(cuerpo.codigo, 64) : null
  const pinNuevo = cuerpo ? cadena(cuerpo.pinNuevo, 6) : null
  const numero = telefono ? telefonoNormalizado(telefono) : ''
  const codigo = codigoTexto ? normalizarCodigo(codigoTexto) : null
  if (!cuerpo || numero.length < 10 || numero.length > 15 || !codigo) return fallo(401, 'credenciales')
  if (!pinNuevo || !pinValido(pinNuevo)) return fallo(400, 'pin_flojo')

  if (deps.verificarCaptcha) {
    // Antes de contar: sin captcha no se pueden quemar los intentos ajenos.
    const token = typeof cuerpo.captchaToken === 'string' ? cuerpo.captchaToken.slice(0, 4096) : ''
    if (!token || !(await deps.verificarCaptcha(token))) return fallo(400, 'verificacion')
  }

  const clave = `recuperar:${numero}`
  const ahora = reloj(deps)
  const espera = await reservarIntento(deps.almacen, clave, ahora)
  if (espera > 0) return bloqueado(espera)

  const rechazar = async (): Promise<RespuestaPin> => {
    const despues = esperaBloqueo(await deps.almacen.leer(clave), ahora)
    return despues > 0 ? bloqueado(despues) : fallo(401, 'credenciales')
  }

  const usuario = await deps.datos.usuarioPorNumero(numero)
  if (!usuario) return rechazar()
  const vinculo = await deps.datos.vinculo(usuario.usuarioId)
  if (!vinculo || vinculo.rol !== 'dueno') return rechazar()

  const hash = await hashCodigo(usuario.usuarioId, codigo, deps.pepper)
  if (!(await deps.datos.consumirCodigo(usuario.usuarioId, hash))) return rechazar()

  try {
    await deps.datos.auditar({
      negocioId: vinculo.negocioId,
      actorId: usuario.usuarioId,
      objetivoId: usuario.usuarioId,
      accion: 'pin_recuperado',
    })
    await deps.datos.cambiarPassword(usuario.usuarioId, await passwordParaCuenta(numero, pinNuevo, deps.pepper))
  } catch (error) {
    // No se le quema el código por una falla nuestra.
    await deps.datos.guardarCodigo(usuario.usuarioId, hash).catch(() => {})
    throw error
  }
  await deps.datos.marcarCambio(usuario.usuarioId, false)
  const codigoRecuperacion = await emitirCodigoRecuperacion(usuario.usuarioId, deps)
  await deps.almacen.limpiar(clave)
  // Con el PIN nuevo, el bloqueo del ingreso por intentos viejos ya no aplica.
  await deps.almacen.limpiar(numero)
  return ok({ codigoRecuperacion })
}
