import type { Centavos } from './tipos'

/** Los billetes con los que más seguido paga la gente: se redondea el total
 *  hacia arriba al próximo múltiplo de cada uno. */
const REDONDEOS_EN_PESOS = [1000, 5000, 10000, 20000, 50000]
const MAX_DIGITOS = 7

/** Lo que probablemente te dé el cliente, de menor a mayor, sin repetir y sin
 *  contar el pago justo (ese tiene su propio botón). Ejemplo: para $13.050
 *  sugiere $14.000, $15.000 y $20.000. */
export function sugerenciasDePago(total: Centavos, cantidad = 3): Centavos[] {
  const enPesos = Math.ceil(total / 100)
  const candidatos = REDONDEOS_EN_PESOS
    .map((paso) => Math.ceil(enPesos / paso) * paso)
    .filter((valor) => valor > total / 100)
  return [...new Set(candidatos)].sort((a, b) => a - b).slice(0, cantidad).map((pesos) => pesos * 100)
}

export type TeclaCobro = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'borrar'

/** El teclado numérico del cobro. `actual` son los pesos escritos hasta ahora
 *  (sólo dígitos). Sin ceros a la izquierda y con un tope de siete dígitos. */
export function teclear(actual: string, tecla: TeclaCobro): string {
  if (tecla === 'borrar') return actual.slice(0, -1)
  const siguiente = `${actual}${tecla}`.replace(/^0+/, '')
  return siguiente.length > MAX_DIGITOS ? actual : siguiente
}

/** Lo que el cliente escribió o tocó, a pesos enteros: se queda con los
 *  dígitos y descarta puntos, comas y letras. */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS)
}

/** "20000" → "20.000" para mostrarlo; vacío se queda vacío. */
export function conPuntos(digitos: string): string {
  return digitos === '' ? '' : Number(digitos).toLocaleString('es-AR')
}
