import { validarPedido, normalizarItems, partirDataUrl } from './validacion'
import { createClient } from '@supabase/supabase-js'

// Lectura de facturas por foto. Usa la API de ChatGPT (OpenAI) con visión,
// llamada por fetch directo: es una sola llamada y así no hace falta un SDK.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODELO = 'gpt-4o-mini'
const MAX_CUERPO_BYTES = 13_000_000
const VENTANA_RATE_LIMIT_MS = 5 * 60_000
const MAX_SOLICITUDES_POR_VENTANA = 10
const limites = new Map<string, { inicio: number; cantidad: number }>()

const INSTRUCCION = `Sos un asistente que lee facturas de mayoristas argentinos para un almacén de barrio.

Extraé cada renglón de mercadería de la foto y devolvé SOLAMENTE un JSON con esta forma exacta,
sin texto alrededor y sin bloque de código:

{"items":[{"nombre":"...","cantidad":0,"costoUnitario":0}]}

Reglas:
- "costoUnitario" es el precio por unidad EN PESOS (no el total del renglón, no centavos).
- Si el renglón muestra sólo el total, dividilo por la cantidad.
- "cantidad" es un número entero de unidades.
- Si un dato no se lee con seguridad, omití ese renglón entero: es preferible
  que falte un producto a que el almacenero cargue un precio inventado.
- No incluyas descuentos, impuestos ni el total de la factura como si fueran productos.`

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function cuentaConAcceso(pedido: Request): Promise<{ ok: true; usuarioId: string } | { ok: false; status: number; motivo: string }> {
  const authorization = pedido.headers.get('authorization') ?? ''
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !clave) return { ok: false, status: 503, motivo: 'la nube no está configurada' }
  if (!/^Bearer\s+\S+$/i.test(authorization)) return { ok: false, status: 401, motivo: 'hay que iniciar sesión' }

  const supabase = createClient(url, clave, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const identidad = await supabase.auth.getUser()
  if (identidad.error || !identidad.data.user) return { ok: false, status: 401, motivo: 'la sesión no es válida' }

  const vinculo = await supabase
    .from('usuarios_negocio')
    .select('negocio_id')
    .eq('usuario_id', identidad.data.user.id)
    .maybeSingle()
  if (vinculo.error || !vinculo.data?.negocio_id) return { ok: false, status: 403, motivo: 'la cuenta no tiene un negocio asociado' }

  const suscripcion = await supabase
    .from('suscripciones')
    .select('estado,vence_en')
    .eq('negocio_id', vinculo.data.negocio_id)
    .maybeSingle()
  const vence = suscripcion.data?.vence_en ? new Date(suscripcion.data.vence_en).getTime() : 0
  const vigente = (suscripcion.data?.estado === 'prueba' || suscripcion.data?.estado === 'activa') && Number.isFinite(vence) && vence > Date.now()
  if (suscripcion.error || !vigente) return { ok: false, status: 403, motivo: 'la suscripción no está vigente' }

  return { ok: true, usuarioId: identidad.data.user.id }
}

function puedeProcesar(usuarioId: string): boolean {
  const ahora = Date.now()
  const actual = limites.get(usuarioId)
  if (!actual || ahora - actual.inicio >= VENTANA_RATE_LIMIT_MS) {
    limites.set(usuarioId, { inicio: ahora, cantidad: 1 })
    if (limites.size > 2_000) {
      for (const [clave, valor] of limites) {
        if (ahora - valor.inicio >= VENTANA_RATE_LIMIT_MS) limites.delete(clave)
      }
    }
    return true
  }
  if (actual.cantidad >= MAX_SOLICITUDES_POR_VENTANA) return false
  actual.cantidad += 1
  return true
}

export async function POST(pedido: Request) {
  const tamanio = Number(pedido.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanio) && tamanio > MAX_CUERPO_BYTES) {
    return json({ error: 'la imagen es demasiado grande' }, 413)
  }

  let acceso: Awaited<ReturnType<typeof cuentaConAcceso>>
  try {
    acceso = await cuentaConAcceso(pedido)
  } catch {
    return json({ error: 'no se pudo validar el acceso' }, 503)
  }
  if (!acceso.ok) return json({ error: acceso.motivo }, acceso.status)
  if (!puedeProcesar(acceso.usuarioId)) return json({ error: 'alcanzaste el límite de lecturas. Probá de nuevo en unos minutos' }, 429)

  let cuerpo: unknown
  try {
    cuerpo = await pedido.json()
  } catch {
    return json({ error: 'el pedido no es JSON válido' }, 400)
  }

  const validacion = validarPedido(cuerpo)
  if (!validacion.ok) {
    return json({ error: validacion.motivo }, 400)
  }

  const imagen = partirDataUrl((cuerpo as { imagenBase64: string }).imagenBase64)
  if (!imagen) {
    return json({ error: 'la imagen no es válida' }, 400)
  }

  if (!process.env.OPENAI_API_KEY) {
    return json({ error: 'la lectura de facturas todavía no está activada' }, 503)
  }

  try {
    const respuesta = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [
          { role: 'system', content: INSTRUCCION },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraé los productos de esta factura.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imagen.tipo};base64,${imagen.datos}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (respuesta.status === 429) {
      return json({ error: 'probá de nuevo en un minuto' }, 429)
    }
    if (!respuesta.ok) {
      return json({ error: 'no se pudo leer la factura' }, 502)
    }

    const datos = (await respuesta.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const texto = datos.choices?.[0]?.message?.content ?? ''

    // El modelo puede envolver el JSON en explicaciones: se toma el objeto.
    const desde = texto.indexOf('{')
    const hasta = texto.lastIndexOf('}')
    if (desde === -1 || hasta === -1) {
      return Response.json({ error: 'no se entendió la factura' }, { status: 422 })
    }

    const crudo = JSON.parse(texto.slice(desde, hasta + 1)) as { items?: unknown }
    return json({ items: Array.isArray(crudo.items) ? normalizarItems(crudo.items) : [] })
  } catch {
    return json({ error: 'no se pudo leer la factura' }, 502)
  }
}
