import { describe, it, expect } from 'vitest'
import { cantidadDeBilletes, totalArqueo } from '@/dominio/billetes'

describe('arqueo por billetes', () => {
  it('suma billetes por cantidad más las monedas', () => {
    expect(totalArqueo({ 20000: 1, 1000: 3, 10: 2 }, 5000)).toBe((20000 + 3000 + 20) * 100 + 5000)
    expect(cantidadDeBilletes({ 20000: 1, 1000: 3, 10: 2 })).toBe(6)
  })
  it('ignora cantidades negativas o rotas', () => {
    expect(totalArqueo({ 1000: -2, 500: Number.NaN, 100: 1.7 })).toBe(10000)
  })
})
