import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mockSetSession = vi.fn()
const mockFetch = vi.fn()

vi.mock('@/datos/nube/cliente', () => ({
  cliente: {
    auth: { setSession: (...args: unknown[]) => mockSetSession(...args), signInWithPassword: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
  nubeActiva: () => true,
}))

import { PantallaAcceso } from '@/ui/sistema/PantallaAcceso'

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

function completarYEnviar(telefono = '2615551234', pin = '482913') {
  fireEvent.change(screen.getByLabelText('Tu teléfono'), { target: { value: telefono } })
  fireEvent.change(screen.getByLabelText('PIN de 6 números'), { target: { value: pin } })
  fireEvent.click(screen.getByRole('button', { name: /entrar a mi negocio/i }))
}

describe('PantallaAcceso: intentos de PIN', () => {
  const fetchOriginal = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = fetchOriginal
    vi.unstubAllEnvs()
  })

  it('con el teléfono bloqueado muestra cuántos minutos esperar', async () => {
    mockFetch.mockResolvedValue(respuesta(429, { ok: false, error: 'bloqueado', reintentarEnSegundos: 600 }))
    render(<PantallaAcceso />)
    completarYEnviar()

    expect((await screen.findByRole('alert')).textContent).toBe('Demasiados intentos. Esperá 10 minutos y probá de nuevo.')
  })

  it('un PIN equivocado no revela si el teléfono existe', async () => {
    mockFetch.mockResolvedValue(respuesta(401, { ok: false, error: 'credenciales' }))
    render(<PantallaAcceso />)
    completarYEnviar()

    const aviso = (await screen.findByRole('alert')).textContent ?? ''
    expect(aviso).toBe('ese teléfono y PIN no coinciden con ningún negocio')
    expect(aviso).not.toMatch(/no existe|no está registrado/i)
  })

  it('sin verificación humana configurada no muestra nada extra y deja entrar', () => {
    render(<PantallaAcceso />)
    expect(screen.queryByTestId('verificacion-humana')).toBeNull()
    expect((screen.getByRole('button', { name: /entrar a mi negocio/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('con verificación humana configurada, no deja enviar hasta resolverla', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'clave-de-sitio')
    render(<PantallaAcceso />)
    expect(screen.getByTestId('verificacion-humana')).toBeTruthy()
    expect((screen.getByRole('button', { name: /entrar a mi negocio/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})
