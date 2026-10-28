// Puente del ingreso con teléfono + PIN hacia la función `ingresar` de Supabase.
//
// Igual que /api/admin: este endpoint no decide nada. El conteo de intentos y
// el bloqueo viven en la función (con service role y una tabla que el
// navegador no puede tocar), así que llamarla directo no saltea el límite.
// Si la función todavía no está desplegada responde 501 y el navegador entra
// como antes, para no dejar a nadie afuera durante el cambio.
const MAX_CUERPO_BYTES = 4_096
const TIEMPO_MAXIMO_MS = 20_000

function json(cuerpo: unknown, status: number): Response {
  return Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(pedido: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !clave) return json({ ok: false, error: 'servicio' }, 503)

  const declarado = Number(pedido.headers.get('content-length') ?? 0)
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_BYTES) return json({ ok: false, error: 'credenciales' }, 413)
  const cuerpo = await pedido.text()
  if (cuerpo.length > MAX_CUERPO_BYTES) return json({ ok: false, error: 'credenciales' }, 413)

  try {
    const respuesta = await fetch(`${url}/functions/v1/ingresar`, {
      method: 'POST',
      // Las claves nuevas (sb_publishable_…) no son JWT: van sólo en `apikey`.
      headers: {
        apikey: clave,
        ...(clave.startsWith('sb_') ? {} : { Authorization: `Bearer ${clave}` }),
        'Content-Type': 'application/json',
      },
      body: cuerpo,
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    if (respuesta.status === 404) return json({ ok: false, error: 'no_disponible' }, 501)
    return new Response(await respuesta.text(), {
      status: respuesta.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch {
    return json({ ok: false, error: 'servicio' }, 502)
  }
}
