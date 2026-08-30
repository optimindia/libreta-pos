import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { convieneRespaldarAhora } from '@/ui/config/Respaldo'

describe('convieneRespaldarAhora', () => {
  it('no molesta a quien recién abrió la aplicación', () => {
    expect(convieneRespaldarAhora(0, 0)).toBe(false)
    expect(convieneRespaldarAhora(1, 2)).toBe(false)
  })

  it('ofrece respaldo cuando ya hay un catálogo cargado', () => {
    expect(convieneRespaldarAhora(0, 10)).toBe(true)
  })

  it('ofrece respaldo cuando ya hubo una jornada de ventas', () => {
    expect(convieneRespaldarAhora(20, 0)).toBe(true)
  })
})
