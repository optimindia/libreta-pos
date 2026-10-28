import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { credencialesDesdeTelefono, validarPin, entrar } from '@/datos/nube/sesion'
import { db } from '@/datos/local/db'

const mockSignIn = vi.fn()
const mockSetSession = vi.fn()
const mockVinculo = vi.fn()
const mockFetch = vi.fn()

// Vitest no carga .env.local, así que sin este mock el `cliente` real
// sería null y `entrar` no podría probarse.
vi.mock('@/datos/nube/cliente', () => ({
  cliente: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mockVinculo() }),
      }),
    }),
  },
  nubeActiva: () => true,
}))

const fetchOriginal = globalThis.fetch

beforeEach(async () => {
  vi.clearAllMocks()
  globalThis.fetch = mockFetch as unknown as typeof fetch
  await db.delete()
  await db.open()
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

const SESION = { access_token: 'acceso', refresh_token: 'refresco' }

describe('credencialesDesdeTelefono', () => {
  it('arma siempre las mismas credenciales para el mismo teléfono y PIN', () => {
    const a = credencialesDesdeTelefono('261 555-1234', '123456')
    const b = credencialesDesdeTelefono('(261)5551234', '123456')
    expect(a).toEqual(b)
  })

  it('usa el teléfono normalizado con código de país', () => {
    expect(credencialesDesdeTelefono('2615551234', '123456').email)
      .toBe('542615551234@libreta.app')
  })

  it('no manda el PIN pelado como contraseña', () => {
    const { password } = credencialesDesdeTelefono('2615551234', '123456')
    expect(password).not.toBe('123456')
    expect(password.length).toBeGreaterThanOrEqual(12)
  })

  it('PIN distinto da contraseña distinta', () => {
    const a = credencialesDesdeTelefono('2615551234', '123456')
    const b = credencialesDesdeTelefono('2615551234', '654321')
    expect(a.password).not.toBe(b.password)
  })
})

describe('validarPin', () => {
  it('acepta seis dígitos', () => {
    expect(validarPin('123456')).toBe(true)
  })

  it('rechaza menos de seis dígitos', () => {
    expect(validarPin('1234')).toBe(false)
  })

  it('rechaza cualquier cosa que no sean números', () => {
    expect(validarPin('12345a')).toBe(false)
  })

  it('rechaza los PIN obvios, que son los que se adivinan primero', () => {
    expect(validarPin('123456')).toBe(true)
    expect(validarPin('000000')).toBe(false)
    expect(validarPin('111111')).toBe(false)
  })
})

describe('entrar', () => {
  it('entra por el servidor (que cuenta los intentos) y guarda el negocio vinculado', async () => {
    mockFetch.mockResolvedValue(respuesta(200, { ok: true, sesion: SESION }))
    mockSetSession.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: { negocio_id: 'nube-1' } })

    const resultado = await entrar('2615551234', '123456')

    expect(resultado).toEqual({ ok: true, negocioId: 'nube-1' })
    const [destino, opciones] = mockFetch.mock.calls[0]
    expect(destino).toBe('/api/ingresar')
    expect(JSON.parse(String((opciones as RequestInit).body))).toEqual({ telefono: '2615551234', pin: '123456' })
    expect(mockSetSession).toHaveBeenCalledWith(SESION)
    // El navegador ya no le pega directo a Auth con la contraseña.
    expect(mockSignIn).not.toHaveBeenCalled()
    const local = await db.negocio.get('unico')
    expect(local?.negocioId).toBe('nube-1')
    expect(local?.telefono).toBe('542615551234')
  })

  it('manda el token de verificación humana cuando lo hay', async () => {
    mockFetch.mockResolvedValue(respuesta(401, { ok: false, error: 'credenciales' }))
    await entrar('2615551234', '123456', { captchaToken: 'tok' })
    expect(JSON.parse(String((mockFetch.mock.calls[0][1] as RequestInit).body)).captchaToken).toBe('tok')
  })

  it('con teléfono o PIN equivocados devuelve el motivo claro, sin decir si el teléfono existe', async () => {
    mockFetch.mockResolvedValue(respuesta(401, { ok: false, error: 'credenciales' }))
    const resultado = await entrar('2615551234', '000111')
    expect(resultado).toEqual({ ok: false, motivo: 'ese teléfono y PIN no coinciden con ningún negocio' })
  })

  it('bloqueado por intentos avisa cuántos minutos esperar', async () => {
    mockFetch.mockResolvedValue(respuesta(429, { ok: false, error: 'bloqueado', reintentarEnSegundos: 14 * 60 + 5 }))
    const resultado = await entrar('2615551234', '000111')
    expect(resultado).toEqual({
      ok: false,
      motivo: 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.',
      esperaSegundos: 14 * 60 + 5,
    })
  })

  it('con menos de un minuto de espera habla en singular', async () => {
    mockFetch.mockResolvedValue(respuesta(429, { ok: false, error: 'bloqueado', reintentarEnSegundos: 20 }))
    const resultado = await entrar('2615551234', '000111')
    expect(resultado.ok === false && resultado.motivo).toBe('Demasiados intentos. Esperá 1 minuto y probá de nuevo.')
  })

  it('si falta la verificación humana lo pide', async () => {
    mockFetch.mockResolvedValue(respuesta(400, { ok: false, error: 'verificacion' }))
    const resultado = await entrar('2615551234', '000111')
    expect(resultado).toEqual({ ok: false, motivo: 'Completá la verificación de seguridad y probá de nuevo.' })
  })

  it('si el servidor de ingreso todavía no está desplegado entra como antes', async () => {
    mockFetch.mockResolvedValue(respuesta(501, { ok: false, error: 'no_disponible' }))
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: { negocio_id: 'nube-1' } })
    const resultado = await entrar('2615551234', '123456')
    expect(resultado).toEqual({ ok: true, negocioId: 'nube-1' })
    expect(mockSignIn).toHaveBeenCalledWith(credencialesDesdeTelefono('2615551234', '123456'))
  })

  it('si el servidor falla no inventa un motivo sobre la cuenta', async () => {
    mockFetch.mockResolvedValue(respuesta(503, { ok: false, error: 'servicio' }))
    const resultado = await entrar('2615551234', '123456')
    expect(resultado).toEqual({ ok: false, motivo: 'No se pudo validar el acceso. Probá de nuevo en un rato.' })
  })

  it('con una cuenta sin negocio no inventa nada', async () => {
    mockFetch.mockResolvedValue(respuesta(200, { ok: true, sesion: SESION }))
    mockSetSession.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: null })
    const resultado = await entrar('2615551234', '123456')
    expect(resultado).toEqual({ ok: false, motivo: 'esa cuenta no tiene un negocio asociado' })
  })
})
