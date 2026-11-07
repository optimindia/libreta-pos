import type { Centavos, Producto } from './tipos'
import { esFraccionado, redondearCantidad } from './cantidad'

export interface DiferenciaConteo {
  producto: Producto
  esperado: number
  contado: number
  /** contado − esperado: negativo es faltante. */
  diferencia: number
  /** La diferencia a costo. */
  valor: Centavos
}

export interface ResumenConteo {
  contados: number
  conDiferencia: DiferenciaConteo[]
  faltante: Centavos
  sobrante: Centavos
}

/** Lo que se contó se interpreta según la unidad: en los de unidad, sólo
 *  enteros; en kilo o litro, hasta tres decimales. Null si no es válido. */
export function cantidadContada(producto: Pick<Producto, 'unidad'>, texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null
  const valor = Number(limpio)
  if (!Number.isFinite(valor) || valor < 0) return null
  if (!esFraccionado(producto) && !Number.isInteger(valor)) return null
  return redondearCantidad(valor)
}

/** Compara lo contado con lo que dice el sistema. Sólo cuentan los
 *  productos que se contaron. */
export function resumenConteo(productos: Producto[], contados: Record<string, number>): ResumenConteo {
  const conDiferencia: DiferenciaConteo[] = []
  let cuantos = 0
  let faltante = 0
  let sobrante = 0
  for (const producto of productos) {
    const contado = contados[producto.id]
    if (contado === undefined) continue
    cuantos += 1
    const diferencia = redondearCantidad(contado - producto.stock)
    if (diferencia === 0) continue
    const valor = Math.round(diferencia * producto.costo)
    if (valor < 0) faltante += -valor
    else sobrante += valor
    conDiferencia.push({ producto, esperado: producto.stock, contado, diferencia, valor })
  }
  conDiferencia.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor) || a.producto.nombre.localeCompare(b.producto.nombre, 'es'))
  return { contados: cuantos, conDiferencia, faltante, sobrante }
}

/** El producto de un código escaneado (exacto), para sumarle uno. */
export function productoPorCodigo(productos: Producto[], codigo: string): Producto | null {
  const limpio = codigo.trim()
  if (limpio === '') return null
  return productos.find((producto) => producto.codigoBarras === limpio) ?? null
}
