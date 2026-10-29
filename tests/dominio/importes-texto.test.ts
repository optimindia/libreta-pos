import { describe, it, expect } from 'vitest'
import { pesosDeTexto } from '@/dominio/dinero'

describe('pesosDeTexto (importes como se escriben en Argentina)', () => {
  it.each([
    ['1200', 1200],
    ['1.200', 1200],
    ['1.200,50', 1200.5],
    ['800,50', 800.5],
    ['800.5', 800.5],
    ['$ 1.500', 1500],
    ['  30.000 ', 30000],
    ['1,5', 1.5],
  ])('%s -> %s', (texto, esperado) => {
    expect(pesosDeTexto(texto)).toBe(esperado)
  })

  it('un texto vacío o ilegible vale 0', () => {
    expect(pesosDeTexto('')).toBe(0)
    expect(pesosDeTexto('abc')).toBe(0)
  })
})
