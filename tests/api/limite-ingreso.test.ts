// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  LIMITE_INGRESO,
  esperaBloqueo,
  sumarIntento,
  type EstadoIntentos,
} from '../../supabase/functions/_shared/limiteIngreso.ts'

const MIN = 60_000
const T0 = 1_800_000_000_000

function con(estado: Omit<EstadoIntentos, 'version'>): EstadoIntentos {
  return { ...estado, version: 1 }
}

describe('límite de intentos de ingreso', () => {
  it('son 5 fallos en 15 minutos y 15 minutos de bloqueo', () => {
    expect(LIMITE_INGRESO).toEqual({ maxFallos: 5, ventanaMs: 15 * MIN, bloqueoMs: 15 * MIN })
  })

  it('un teléfono sin historial no está bloqueado', () => {
    expect(esperaBloqueo(null, T0)).toBe(0)
  })

  it('el primer intento arranca la cuenta', () => {
    expect(sumarIntento(null, T0)).toEqual({ fallos: 1, desde: T0, bloqueadoHasta: null })
  })

  it('cuatro fallos todavía no bloquean', () => {
    let estado: EstadoIntentos | null = null
    for (let i = 0; i < 4; i++) {
      estado = con(sumarIntento(estado, T0 + i * MIN))
    }
    expect(estado?.fallos).toBe(4)
    expect(estado?.bloqueadoHasta).toBeNull()
    expect(esperaBloqueo(estado, T0 + 4 * MIN)).toBe(0)
  })

  it('el quinto fallo bloquea el teléfono 15 minutos desde ese momento', () => {
    let estado: EstadoIntentos | null = null
    for (let i = 0; i < 5; i++) {
      estado = con(sumarIntento(estado, T0 + i * MIN))
    }
    const quinto = T0 + 4 * MIN
    expect(estado?.bloqueadoHasta).toBe(quinto + 15 * MIN)
    expect(esperaBloqueo(estado, quinto + MIN)).toBe(14 * MIN)
    expect(esperaBloqueo(estado, quinto + 15 * MIN)).toBe(0)
  })

  it('pasada la ventana, los fallos viejos no cuentan', () => {
    const viejo = con({ fallos: 4, desde: T0, bloqueadoHasta: null })
    expect(sumarIntento(viejo, T0 + 15 * MIN)).toEqual({ fallos: 1, desde: T0 + 15 * MIN, bloqueadoHasta: null })
  })

  it('terminado el bloqueo, se vuelve a empezar de cero', () => {
    const bloqueado = con({ fallos: 5, desde: T0, bloqueadoHasta: T0 + 15 * MIN })
    expect(sumarIntento(bloqueado, T0 + 16 * MIN)).toEqual({ fallos: 1, desde: T0 + 16 * MIN, bloqueadoHasta: null })
  })
})
