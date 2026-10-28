// Puente del panel de cuentas hacia la función `admin` de Supabase.
//
// El navegador le habla a este endpoint (mismo sitio) y no directo a Supabase:
// así el panel anda en cualquier dirección donde esté publicada la app
// (producción, previews, dominio propio) sin tener que registrar cada una en
// la lista de orígenes de la función. Este puente NO da ningún permiso: reenvía
// la sesión tal cual, y es la función la que valida el token y el rol de
// administrador antes de hacer algo.
const MAX_CUERPO_BYTES = 64_000
const TIEMPO_MAXIMO_MS = 30_000

function json(cuerpo: unknown, status: number): Response {
  return Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(pedido: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !clave) return json({ error: 'La nube no está configurada.' }, 503)

  const authorization = pedido.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: 'Hay que iniciar sesión.' }, 401)

  const declarado = Number(pedido.headers.get('content-length') ?? 0)
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_BYTES) {
    return json({ error: 'El pedido es demasiado grande.' }, 413)
  }
  const cuerpo = await pedido.text()
  if (cuerpo.length > MAX_CUERPO_BYTES) return json({ error: 'El pedido es demasiado grande.' }, 413)

  try {
    const respuesta = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: { Authorization: authorization, apikey: clave, 'Content-Type': 'application/json' },
      body: cuerpo,
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    return new Response(await respuesta.text(), {
      status: respuesta.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch {
    return json({ error: 'No se pudo conectar con el servidor de cuentas.' }, 502)
  }
}
