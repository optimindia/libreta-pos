// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Esta ruta gasta plata de OpenAI en cada llamada: cualquiera que encuentre
// la URL podría vaciar el crédito. Las pruebas fijan que nada llega al modelo
// sin una sesión válida, y que lo demasiado grande se corta antes de leerlo.
const IMAGEN_CHICA = 'data:image/png;base64,iVBORw0KGgo='

function pedido(cabeceras: Record<string, string> = {}, cuerpo: unknown = { imagenBase64: IMAGEN_CHICA }) {
  return new Request('http://localhost/api/factura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  })
}

describe('POST /api/factura', () => {
  const fetchOriginal = globalThis.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ejemplo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'clave-publica')
    vi.stubEnv('OPENAI_API_KEY', 'clave-secreta')
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = fetchOriginal
  })

  it('sin sesión devuelve 401 y no llama a OpenAI', async () => {
    const { POST } = await import('@/app/api/factura/route')
    const respuesta = await POST(pedido())

    expect(respuesta.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('un Authorization que no es Bearer también es 401', async () => {
    const { POST } = await import('@/app/api/factura/route')
    const respuesta = await POST(pedido({ Authorization: 'Basic abc' }))

    expect(respuesta.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('corta con 413 un pedido enorme antes de leerlo siquiera', async () => {
    const { POST } = await import('@/app/api/factura/route')
    const respuesta = await POST(pedido({ 'Content-Length': '50000000', Authorization: 'Bearer token' }))

    expect(respuesta.status).toBe(413)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sin la nube configurada responde 503 y no llama a OpenAI', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    const { POST } = await import('@/app/api/factura/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token' }))

    expect(respuesta.status).toBe(503)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('nunca guarda la respuesta en caché', async () => {
    const { POST } = await import('@/app/api/factura/route')
    const respuesta = await POST(pedido())

    expect(respuesta.headers.get('cache-control')).toBe('no-store')
  })
})
