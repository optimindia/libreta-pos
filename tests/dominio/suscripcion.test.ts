import { describe, expect, it } from 'vitest'
import { accesoPermitido, diasRestantes, estadoSuscripcion, textoEstadoSuscripcion, type Suscripcion } from '@/dominio/suscripcion'

const AHORA = Date.parse('2026-08-31T12:00:00.000Z')

function suscripcion(parcial: Partial<Suscripcion> = {}): Suscripcion {
  return {
    id: 'sus-1',
    negocioId: 'neg-1',
    estado: 'activa',
    tipo: 'mensual',
    inicioEn: AHORA - 86_400_000,
    venceEn: AHORA + 10 * 86_400_000,
    ...parcial,
  }
}

describe('suscripciones manuales', () => {
  it('permite prueba y plan activo mientras no vencen', () => {
    expect(estadoSuscripcion(suscripcion({ estado: 'prueba' }), AHORA)).toBe('prueba')
    expect(estadoSuscripcion(suscripcion(), AHORA)).toBe('activa')
    expect(accesoPermitido(suscripcion(), AHORA)).toBe(true)
  })

  it('bloquea vencimiento, gracia y suspensión sin excepciones', () => {
    expect(estadoSuscripcion(suscripcion({ venceEn: AHORA - 1 }), AHORA)).toBe('vencida')
    expect(estadoSuscripcion(suscripcion({ estado: 'gracia' }), AHORA)).toBe('gracia')
    expect(estadoSuscripcion(suscripcion({ venceEn: AHORA - 1, graciaHasta: AHORA + 2 * 86_400_000 }), AHORA)).toBe('vencida')
    expect(accesoPermitido(suscripcion({ venceEn: AHORA - 1 }), AHORA)).toBe(false)
    expect(accesoPermitido(suscripcion({ estado: 'gracia' }), AHORA)).toBe(false)
    expect(accesoPermitido(suscripcion({ estado: 'suspendida' }), AHORA)).toBe(false)
  })

  it('calcula días hasta el vencimiento y no devuelve negativos', () => {
    expect(diasRestantes(suscripcion({ venceEn: AHORA + 2 * 86_400_000 }), AHORA)).toBe(2)
    expect(diasRestantes(suscripcion({ venceEn: AHORA - 1, graciaHasta: AHORA + 3 * 86_400_000 }), AHORA)).toBe(0)
    expect(diasRestantes(suscripcion({ venceEn: AHORA - 1 }), AHORA)).toBe(0)
    expect(diasRestantes(null, AHORA)).toBe(0)
  })

  it('permite mostrar avisos de 3 a 1 día sin extender el acceso', () => {
    for (const dias of [3, 2, 1]) {
      const vigente = suscripcion({ venceEn: AHORA + dias * 86_400_000 })
      expect(diasRestantes(vigente, AHORA)).toBe(dias)
      expect(accesoPermitido(vigente, AHORA)).toBe(true)
    }
    expect(accesoPermitido(suscripcion({ venceEn: AHORA }), AHORA)).toBe(false)
  })

  it('expone textos comerciales claros', () => {
    expect(textoEstadoSuscripcion(null, AHORA)).toBe('Sin activar')
    expect(textoEstadoSuscripcion(suscripcion({ estado: 'prueba' }), AHORA)).toBe('Prueba gratuita')
    expect(textoEstadoSuscripcion(suscripcion({ venceEn: AHORA - 1 }), AHORA)).toBe('Vencida')
  })
})
