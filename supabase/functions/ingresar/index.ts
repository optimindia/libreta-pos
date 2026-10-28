// Ingreso con teléfono + PIN, con límite de intentos por teléfono.
//
// Cuenta los intentos en `public.intentos_ingreso` (sólo accesible con
// service role) y, tras 5 fallos en 15 minutos, deja el teléfono bloqueado
// 15 minutos. Las respuestas no dicen si el teléfono existe.
//
// Secretos opcionales (supabase secrets set ...):
//   LIBRETA_PIN_PEPPER    -> contraseñas v2 (HMAC), incalculables desde afuera.
//                            Tiene que ser el mismo que usa la función `admin`.
//   TURNSTILE_SECRET_KEY  -> exige un token de Cloudflare Turnstile válido.
//
// Desplegar con: supabase functions deploy ingresar --no-verify-jwt
// (la valida ella misma: no hay sesión todavía cuando alguien intenta entrar).
import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import { procesarIngreso, type AlmacenIntentos, type ResultadoAuth } from '../_shared/ingreso.ts'
import type { EstadoIntentos } from '../_shared/limiteIngreso.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const pepper = Deno.env.get('LIBRETA_PIN_PEPPER') || undefined
const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || undefined
const TIEMPO_MAXIMO_MS = 15_000

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface FilaIntentos {
  telefono: string
  fallos: number
  desde: string
  bloqueado_hasta: string | null
  version: number
}

const almacen: AlmacenIntentos = {
  async leer(telefono) {
    const { data, error } = await admin
      .from('intentos_ingreso')
      .select('telefono,fallos,desde,bloqueado_hasta,version')
      .eq('telefono', telefono)
      .maybeSingle<FilaIntentos>()
    if (error) throw error
    if (!data) return null
    const estado: EstadoIntentos = {
      fallos: data.fallos,
      desde: new Date(data.desde).getTime(),
      bloqueadoHasta: data.bloqueado_hasta ? new Date(data.bloqueado_hasta).getTime() : null,
      version: Number(data.version),
    }
    return estado
  },
  async guardar(telefono, previo, nuevo) {
    const fila = {
      fallos: nuevo.fallos,
      desde: new Date(nuevo.desde).toISOString(),
      bloqueado_hasta: nuevo.bloqueadoHasta === null ? null : new Date(nuevo.bloqueadoHasta).toISOString(),
      actualizado_en: new Date().toISOString(),
    }
    if (!previo) {
      const { error } = await admin.from('intentos_ingreso').insert({ telefono, ...fila, version: 1 })
      if (!error) return true
      if (error.code === '23505') return false // otro pedido la creó primero
      throw error
    }
    const { data, error } = await admin
      .from('intentos_ingreso')
      .update({ ...fila, version: previo.version + 1 })
      .eq('telefono', telefono)
      .eq('version', previo.version)
      .select('telefono')
    if (error) throw error
    return (data ?? []).length === 1
  },
  async limpiar(telefono) {
    const { error } = await admin.from('intentos_ingreso').delete().eq('telefono', telefono)
    if (error) throw error
  },
}

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
