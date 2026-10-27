// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El puente no da permisos: sólo reenvía la sesión. Las pruebas fijan que
// nunca habla con Supabase sin una sesión, que corta lo desmedido y que
// devuelve tal cual lo que contesta la función (incluidos sus errores).
function pedido(cabeceras: Record<string, string> = {}, cuerpo: unknown = { accion: 'listar' }) {
  return new Request('http://localhost/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  })
}

describe('POST /api/admin', () => {
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

  it('sin sesión devuelve 401 y no llama a Supabase', async () => {
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido())

    expect(respuesta.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sin la nube configurada responde 503', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token' }))

    expect(respuesta.status).toBe(503)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('corta con 413 un pedido enorme', async () => {
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token' }, { nota: 'x'.repeat(70_000) }))

    expect(respuesta.status).toBe(413)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reenvía la sesión a la función y devuelve su respuesta', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, cuentas: [] }), { status: 200 }))
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token-del-admin' }))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, cuentas: [] })
    const [destino, opciones] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(destino).toBe('https://ejemplo.supabase.co/functions/v1/admin')
    const cabeceras = (opciones as RequestInit).headers as Record<string, string>
    expect(cabeceras.Authorization).toBe('Bearer token-del-admin')
    expect(cabeceras.apikey).toBe('clave-publica')
  })

  it('un rechazo de la función (no es administrador) llega sin cambios', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'No tenés permisos para administrar cuentas.' }), { status: 403 }),
    )
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token-de-un-cliente' }))

    expect(respuesta.status).toBe(403)
    expect((await respuesta.json()).error).toBe('No tenés permisos para administrar cuentas.')
  })

  it('si no hay conexión con Supabase responde 502 con un mensaje claro', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('red caída'))
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido({ Authorization: 'Bearer token' }))

    expect(respuesta.status).toBe(502)
    expect((await respuesta.json()).error).toMatch(/servidor de cuentas/)
  })

  it('nunca guarda la respuesta en caché', async () => {
    const { POST } = await import('@/app/api/admin/route')
    const respuesta = await POST(pedido())

    expect(respuesta.headers.get('cache-control')).toBe('no-store')
  })
})
