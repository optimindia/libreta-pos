import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { frenarSuave, useContador } from '@/ui/sistema/usoContador'

const movimiento = (reducido: boolean) => {
  window.matchMedia = ((consulta: string) => ({
    matches: reducido && consulta.includes('reduce'), media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

afterEach(() => { vi.useRealTimers() })

describe('useContador', () => {
  it('la curva arranca en 0, termina en 1 y nunca se pasa', () => {
    expect(frenarSuave(0)).toBe(0)
    expect(frenarSuave(1)).toBe(1)
    for (let t = 0; t <= 1; t += 0.1) expect(frenarSuave(t)).toBeLessThanOrEqual(1)
  })

  it('sube desde 0 hasta el valor y termina exacto', async () => {
    movimiento(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { result } = renderHook(() => useContador(276500, { duracion: 500 }))
    expect(result.current).toBe(0)
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(276500)
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(result.current).toBe(276500)
  })

  it('con paso 100 los números intermedios son pesos enteros', async () => {
    movimiento(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { result } = renderHook(() => useContador(276543, { duracion: 500, paso: 100 }))
    for (const ms of [50, 120, 200, 300]) {
      await act(async () => { vi.advanceTimersByTime(ms) })
      if (result.current !== 276543) expect(result.current % 100).toBe(0)
    }
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(276543)
  })

  it('con "reducir movimiento" muestra el valor final de entrada', () => {
    movimiento(true)
    const { result } = renderHook(() => useContador(276500))
    expect(result.current).toBe(276500)
  })

  it('sin animar arranca en el valor final', () => {
    movimiento(false)
    const { result } = renderHook(() => useContador(1200, { animar: false }))
    expect(result.current).toBe(1200)
  })
})
