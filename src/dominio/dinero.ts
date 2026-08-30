import type { Centavos } from './tipos'

const formatoSinDecimales = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const formatoConDecimales = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatearPesos(centavos: Centavos): string {
  const signo = centavos < 0 ? '-' : ''
  const absoluto = Math.abs(centavos)
  const pesos = absoluto / 100
  const texto =
    absoluto % 100 === 0
      ? formatoSinDecimales.format(pesos)
      : formatoConDecimales.format(pesos)
  return `${signo}$${texto}`
}

export function pesosACentavos(pesos: number): Centavos {
  return Math.round(pesos * 100)
}

export function sumar(...montos: Centavos[]): Centavos {
  return montos.reduce((total, monto) => total + monto, 0)
}

export function multiplicar(centavos: Centavos, cantidad: number): Centavos {
  return Math.round(centavos * cantidad)
}

/** Lo que hay que devolver al cliente: negativo cuando el pago no alcanza. */
export function vuelto(entregado: Centavos, total: Centavos): Centavos {
  return entregado - total
}
