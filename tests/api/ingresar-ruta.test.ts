// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El puente no decide nada: el conteo de intentos y el bloqueo viven en la
// función `ingresar` de Supabase. Acá sólo se fija que reenvía sin tocar,
// que corta lo desmedido y que avisa cuando la función no está desplegada.
function pedido(cuerpo: unknown = { telefono: '2615551234', pin: '482913' }) {
  return new Request('http://localhost/api/ingresar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })
}

describe('POST /api/ingresar', () => {
  const fetchOriginal = globalThis.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ejemplo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'clave-publica')
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = fetchOriginal
  })

  it('reenvía el pedido a la función `ingresar` con la clave pública', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, sesion: { access_token: 'a', refresh_token: 'r' } }), { status: 200 }))
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())

    expect(respuesta.status).toBe(200)
    expect((await respuesta.json()).ok).toBe(true)
    const [destino, opciones] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(destino).toBe('https://ejemplo.supabase.co/functions/v1/ingresar')
    const cabeceras = (opciones as RequestInit).headers as Record<string, string>
    expect(cabeceras.apikey).toBe('clave-publica')
    expect(JSON.parse(String((opciones as RequestInit).body))).toEqual({ telefono: '2615551234', pin: '482913' })
  })

  it('un bloqueo llega tal cual', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'bloqueado', reintentarEnSegundos: 600 }), { status: 429 }),
    )
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())

    expect(respuesta.status).toBe(429)
    expect(await respuesta.json()).toEqual({ ok: false, error: 'bloqueado', reintentarEnSegundos: 600 })
  })

  it('si la función todavía no está desplegada responde 501 "no_disponible"', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }))
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())

    expect(respuesta.status).toBe(501)
    expect(await respuesta.json()).toEqual({ ok: false, error: 'no_disponible' })
  })

  it('corta con 413 un pedido enorme sin llamar a Supabase', async () => {
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido({ telefono: 'x'.repeat(5_000), pin: '1' }))
    expect(respuesta.status).toBe(413)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sin la nube configurada responde 503', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())
    expect(respuesta.status).toBe(503)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('si no hay conexión con Supabase responde 502', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('red caída'))
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())
    expect(respuesta.status).toBe(502)
    expect((await respuesta.json()).error).toBe('servicio')
  })

  it('nunca guarda la respuesta en caché', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('{}', { status: 401 }))
    const { POST } = await import('@/app/api/ingresar/route')
    const respuesta = await POST(pedido())
    expect(respuesta.headers.get('cache-control')).toBe('no-store')
  })
})
