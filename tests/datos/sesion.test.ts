import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { credencialesDesdeTelefono, validarPin, entrar } from '@/datos/nube/sesion'
import { db } from '@/datos/local/db'

const mockSignIn = vi.fn()
const mockVinculo = vi.fn()

// Vitest no carga .env.local, así que sin este mock el `cliente` real
// sería null y `entrar` no podría probarse.
vi.mock('@/datos/nube/cliente', () => ({
  cliente: {
    auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mockVinculo() }),
      }),
    }),
  },
  nubeActiva: () => true,
}))

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete()
  await db.open()
})

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
  it('inicia sesión y guarda el negocio vinculado localmente', async () => {
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: { negocio_id: 'nube-1' } })

    const resultado = await entrar('2615551234', '123456')

    expect(resultado).toEqual({ ok: true, negocioId: 'nube-1' })
    const local = await db.negocio.get('unico')
    expect(local?.negocioId).toBe('nube-1')
    expect(local?.telefono).toBe('542615551234')
  })

  it('con teléfono o PIN equivocados devuelve el motivo claro', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' }, data: {} })
    const resultado = await entrar('2615551234', '000111')
    expect(resultado).toEqual({ ok: false, motivo: 'ese teléfono y PIN no coinciden con ningún negocio' })
  })

  it('con una cuenta sin negocio no inventa nada', async () => {
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: null })
    const resultado = await entrar('2615551234', '123456')
    expect(resultado).toEqual({ ok: false, motivo: 'esa cuenta no tiene un negocio asociado' })
  })
})
