import { validarPedido, normalizarItems, partirDataUrl } from './validacion'

// Lectura de facturas por foto. Usa la API de ChatGPT (OpenAI) con visión,
// llamada por fetch directo: es una sola llamada y así no hace falta un SDK.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODELO = 'gpt-4o-mini'

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

export async function POST(pedido: Request) {
  let cuerpo: unknown
  try {
    cuerpo = await pedido.json()
  } catch {
    return Response.json({ error: 'el pedido no es JSON válido' }, { status: 400 })
  }

  const validacion = validarPedido(cuerpo)
  if (!validacion.ok) {
    return Response.json({ error: validacion.motivo }, { status: 400 })
  }

  const imagen = partirDataUrl((cuerpo as { imagenBase64: string }).imagenBase64)
  if (!imagen) {
    return Response.json({ error: 'la imagen no es válida' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'la lectura de facturas todavía no está activada' },
      { status: 503 },
    )
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
      return Response.json({ error: 'probá de nuevo en un minuto' }, { status: 429 })
    }
    if (!respuesta.ok) {
      return Response.json({ error: 'no se pudo leer la factura' }, { status: 502 })
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

    const crudo = JSON.parse(texto.slice(desde, hasta + 1)) as { items?: unknown[] }
    return Response.json({ items: normalizarItems(crudo.items ?? []) })
  } catch {
    return Response.json({ error: 'no se pudo leer la factura' }, { status: 502 })
  }
}