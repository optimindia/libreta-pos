import { describe, it, expect } from 'vitest'
import { temaInicial } from '@/ui/sistema/tema'

describe('temaInicial', () => {
  it('respeta la elección explícita del usuario por encima de la hora', () => {
    expect(temaInicial('claro', 23)).toBe('claro')
    expect(temaInicial('oscuro', 10)).toBe('oscuro')
  })

  it('en automático usa claro durante el día de mostrador', () => {
    expect(temaInicial('auto', 13)).toBe('claro')
    expect(temaInicial('auto', 7)).toBe('claro')
  })

  it('en automático pasa a oscuro para el turno noche', () => {
    expect(temaInicial('auto', 20)).toBe('oscuro')
    expect(temaInicial('auto', 3)).toBe('oscuro')
  })

  it('los bordes de la franja diurna son 7 y 19', () => {
    expect(temaInicial('auto', 19)).toBe('oscuro')
    expect(temaInicial('auto', 18)).toBe('claro')
  })
})
