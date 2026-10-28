import { describe, it, expect } from 'vitest'
import { MAXIMO_SIN_VERIFICAR_MS, puedeOperarSinVerificar, type Suscripcion } from '@/dominio/suscripcion'

const ahora = Date.UTC(2026, 9, 28, 12)
const vigente: Suscripcion = { id: 's', negocioId: 'n', estado: 'activa', tipo: 'mensual', inicioEn: ahora - 86_400_000, venceEn: ahora + 10 * 86_400_000 }

describe('puedeOperarSinVerificar', () => {
  it('sigue vendiendo sin señal si el servidor confirmó hace poco y no venció', () => {
    expect(puedeOperarSinVerificar(vigente, ahora - 3_600_000, ahora)).toBe(true)
  })
  it('después del máximo sin verificar, bloquea', () => {
    expect(puedeOperarSinVerificar(vigente, ahora - MAXIMO_SIN_VERIFICAR_MS - 1, ahora)).toBe(false)
  })
  it('nunca pasa del vencimiento aunque se haya verificado recién', () => {
    expect(puedeOperarSinVerificar({ ...vigente, venceEn: ahora - 1 }, ahora - 1000, ahora)).toBe(false)
  })
  it('sin verificación previa o suspendida, bloquea', () => {
    expect(puedeOperarSinVerificar(vigente, undefined, ahora)).toBe(false)
    expect(puedeOperarSinVerificar({ ...vigente, estado: 'suspendida' }, ahora - 1000, ahora)).toBe(false)
  })
  it('una marca en el futuro (reloj tocado) no vale', () => {
    expect(puedeOperarSinVerificar(vigente, ahora + 3_600_000, ahora)).toBe(false)
  })
})
