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

/** Números como los escribe cualquiera en Argentina: "1.500" son mil
 *  quinientos, "1.500,50" lleva coma decimal y "$ 1500" trae el signo.
 *  También lee el formato que exporta la app ("4200.5"). */
export function pesosDeTexto(texto: string | undefined): number {
  let limpio = (texto ?? '').replace(/[$\s]/g, '')
  if (limpio === '') return 0
  const punto = limpio.lastIndexOf('.')
  const coma = limpio.lastIndexOf(',')
  if (punto >= 0 && coma >= 0) {
    // El último separador es el decimal; el otro, de miles.
    limpio = coma > punto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '')
  } else if (coma >= 0) {
    limpio = /^-?\d{1,3}(,\d{3})+$/.test(limpio) && limpio.split(',').length > 2 ? limpio.replace(/,/g, '') : limpio.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '')
  }
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : 0
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
