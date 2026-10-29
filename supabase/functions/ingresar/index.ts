// Ingreso con teléfono + PIN, con límite de intentos por teléfono.
//
// Cuenta los intentos en `public.intentos_ingreso` (sólo accesible con
// service role) y, tras 5 fallos en 15 minutos, deja el teléfono bloqueado
// 15 minutos. Las respuestas no dicen si el teléfono existe.
//
// También atiende `{ accion: 'recuperar', telefono, codigo, pinNuevo }`: el
// dueño que olvidó su PIN lo recupera con su código de un solo uso (SEG-04).
//
// Secretos opcionales (supabase secrets set ...):
//   LIBRETA_PIN_PEPPER    -> contraseñas v2 (HMAC), incalculables desde afuera.
//                            Tiene que ser el mismo que usa la función `admin`.
//   TURNSTILE_SECRET_KEY  -> exige un token de Cloudflare Turnstile válido.
//
// Desplegar con: supabase functions deploy ingresar --no-verify-jwt
// (la valida ella misma: no hay sesión todavía cuando alguien intenta entrar).
import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import { procesarIngreso, type ResultadoAuth } from '../_shared/ingreso.ts'
import { crearAlmacenIntentos } from '../_shared/almacenIntentos.ts'
import { crearDatosPin } from '../_shared/depsPin.ts'
import { procesarRecuperacion } from '../_shared/recuperacionPin.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const pepper = Deno.env.get('LIBRETA_PIN_PEPPER') || undefined
const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || undefined
const TIEMPO_MAXIMO_MS = 15_000

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const almacen = crearAlmacenIntentos(admin)

/** Pide la sesión a Auth con la clave de servicio: así, si se activa el
 *  captcha de Supabase Auth para cerrar la puerta directa, esta función
 *  sigue pudiendo entrar (Auth no pide captcha a pedidos con rol admin). */
async function autenticar(email: string, password: string): Promise<ResultadoAuth> {
  try {
    const respuesta = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    const cuerpo = await respuesta.json().catch(() => ({}))
    if (respuesta.ok && cuerpo?.access_token && cuerpo?.refresh_token && cuerpo?.user?.id) {
      return { tipo: 'ok', usuarioId: cuerpo.user.id, sesion: cuerpo }
    }
    const codigo = String(cuerpo?.error_code ?? cuerpo?.error ?? '')
    if (respuesta.status === 400 && /invalid_credentials|invalid_grant/.test(codigo)) return { tipo: 'rechazado' }
    return { tipo: 'error' }
  } catch {
    return { tipo: 'error' }
  }
}

async function cambiarPassword(usuarioId: string, password: string): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password })
  if (error) throw error
}

async function verificarTurnstile(token: string): Promise<boolean> {
  try {
    const datos = new FormData()
    datos.append('secret', turnstileSecret ?? '')
    datos.append('response', token)
    const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: datos,
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    const cuerpo = await respuesta.json()
    return cuerpo?.success === true
  } catch {
    return false
  }
}

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'servicio' }, 503)

  const texto = await req.text()
  if (texto.length > 4_096) return json({ ok: false, error: 'credenciales' }, 413)
  let entrada: unknown = null
  try {
    entrada = JSON.parse(texto)
  } catch {
    // Se responde como cualquier pedido inválido.
  }

  try {
    // Recuperación del PIN del dueño con su código (SEG-04). Va por esta
    // función porque no hay sesión todavía y ya está desplegada sin JWT.
    if (entrada && typeof entrada === 'object' && (entrada as Record<string, unknown>).accion === 'recuperar') {
      const { status, cuerpo } = await procesarRecuperacion(entrada, {
        datos: crearDatosPin(admin, supabaseUrl, serviceKey),
        almacen,
        pepper,
        verificarCaptcha: turnstileSecret ? verificarTurnstile : undefined,
      })
      return json(cuerpo, status)
    }
    const { status, cuerpo } = await procesarIngreso(entrada, {
      almacen,
      autenticar,
      cambiarPassword,
      pepper,
      verificarCaptcha: turnstileSecret ? verificarTurnstile : undefined,
    })
    return json(cuerpo, status)
  } catch {
    return json({ ok: false, error: 'servicio' }, 503)
  }
})
