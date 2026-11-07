import type { Centavos } from './tipos'

/** Billetes argentinos en circulación, de mayor a menor (en pesos). */
export const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const

export type ConteoBilletes = Partial<Record<number, number>>

/** Total del arqueo: billetes por cantidad, más las monedas sueltas. */
export function totalArqueo(conteo: ConteoBilletes, monedas: Centavos = 0): Centavos {
  let total = monedas
  for (const billete of BILLETES) {
    const cantidad = conteo[billete] ?? 0
    if (Number.isFinite(cantidad) && cantidad > 0) total += Math.floor(cantidad) * billete * 100
  }
  return total
}

/** Cuántos billetes se contaron en total. */
export function cantidadDeBilletes(conteo: ConteoBilletes): number {
  return BILLETES.reduce((total, billete) => total + Math.max(0, Math.floor(conteo[billete] ?? 0)), 0)
}
