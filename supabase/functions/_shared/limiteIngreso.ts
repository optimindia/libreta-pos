// Regla de bloqueo por intentos de PIN. Código puro: lo usa la función
// `ingresar` (Deno) y lo prueban los tests (vitest), sin depender de ninguno.
//
// Se cuenta ANTES de probar el PIN (cada intento suma), y un ingreso correcto
// borra la cuenta. Así, aunque lleguen muchos pedidos a la vez, nunca se le
// pregunta a Auth más de `maxFallos` veces por ventana.

export const LIMITE_INGRESO = {
  maxFallos: 5,
  ventanaMs: 15 * 60_000,
  bloqueoMs: 15 * 60_000,
} as const

export interface EstadoIntentos {
  fallos: number
  /** Inicio de la ventana, en milisegundos. */
  desde: number
  /** Hasta cuándo está bloqueado el teléfono, o null. */
  bloqueadoHasta: number | null
  /** Para escribir sólo si nadie escribió en el medio. */
  version: number
}

export type EstadoNuevo = Omit<EstadoIntentos, 'version'>

/** Milisegundos que faltan para poder volver a intentar (0 = libre). */
export function esperaBloqueo(estado: EstadoIntentos | null, ahora: number): number {
  if (!estado || estado.bloqueadoHasta === null) return 0
  return Math.max(0, estado.bloqueadoHasta - ahora)
}

/** Suma un intento. Si con éste se llega al máximo, queda bloqueado. */
export function sumarIntento(estado: EstadoIntentos | null, ahora: number): EstadoNuevo {
  const ventanaVencida = !estado || ahora - estado.desde >= LIMITE_INGRESO.ventanaMs
  const bloqueoTerminado = estado?.bloqueadoHasta != null && estado.bloqueadoHasta <= ahora
  if (!estado || ventanaVencida || bloqueoTerminado) {
    return nuevoEstado(1, ahora, ahora)
  }
  return nuevoEstado(estado.fallos + 1, estado.desde, ahora)
}

function nuevoEstado(fallos: number, desde: number, ahora: number): EstadoNuevo {
  return {
    fallos,
    desde,
    bloqueadoHasta: fallos >= LIMITE_INGRESO.maxFallos ? ahora + LIMITE_INGRESO.bloqueoMs : null,
  }
}
