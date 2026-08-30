import { describe, it, expect, afterEach, vi } from 'vitest'
import { nuevoId } from '@/dominio/id'

const original = globalThis.crypto

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
})

describe('nuevoId', () => {
  it('devuelve un UUID con el formato esperado', () => {
    expect(nuevoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('no repite ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => nuevoId()))
    expect(ids.size).toBe(500)
  })

  it('usa crypto.randomUUID cuando el navegador la tiene', () => {
    const randomUUID = vi.fn(() => '11111111-1111-4111-8111-111111111111')
    Object.defineProperty(globalThis, 'crypto', {
      value: { ...original, randomUUID }, configurable: true,
    })
    expect(nuevoId()).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('funciona sin crypto.randomUUID, que no existe fuera de HTTPS', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: original.getRandomValues.bind(original) },
      configurable: true,
    })
    expect(nuevoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('funciona incluso sin crypto, sin romper la venta', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    expect(nuevoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
