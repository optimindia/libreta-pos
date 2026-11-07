import type { Centavos, Producto } from './tipos'
import { precioVigente } from './ticket'
import { unidadDe } from './cantidad'

export interface Etiqueta {
  id: string
  nombre: string
  /** Lo que se cobra hoy (la oferta si hay una vigente). */
  precio: Centavos
  /** El precio de lista tachado, sólo si hay oferta. */
  antes: Centavos | null
  /** "el kilo", "el litro" o vacío si es por unidad. */
  medida: string
  codigo: string | null
}

export type CriterioEtiquetas = 'cambiados' | 'oferta' | 'todos'

export function etiquetaDe(producto: Producto, ahora: number): Etiqueta {
  const precio = precioVigente(producto, ahora)
  const unidad = unidadDe(producto)
  return {
    id: producto.id,
    nombre: producto.nombre,
    precio,
    antes: precio !== producto.precio ? producto.precio : null,
    medida: unidad === 'kg' ? 'el kilo' : unidad === 'l' ? 'el litro' : '',
    codigo: producto.codigoBarras,
  }
}

/** Cuándo cambió el precio por última vez (según su historial), o null. */
export function ultimoCambioDePrecio(producto: Producto): number | null {
  const historial = producto.historialPrecios ?? []
  for (let i = historial.length - 1; i > 0; i--) {
    if (historial[i].precio !== historial[i - 1].precio) return historial[i].fecha
  }
  return null
}

/** Los productos a los que les toca etiqueta: los que cambiaron de precio
 *  desde `desde`, los que están en oferta, o todos. Siempre con precio. */
export function productosParaEtiquetas(productos: Producto[], criterio: CriterioEtiquetas, desde: number, ahora: number): Producto[] {
  return productos
    .filter((producto) => producto.precio > 0)
    .filter((producto) => {
      if (criterio === 'oferta') return precioVigente(producto, ahora) !== producto.precio
      if (criterio === 'cambiados') {
        const cuando = ultimoCambioDePrecio(producto)
        return cuando !== null && cuando >= desde
      }
      return true
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export type TamanoEtiqueta = 'chica' | 'grande'

/** Cuántas entran en una hoja A4 de cada tamaño. */
export const POR_HOJA: Record<TamanoEtiqueta, number> = { chica: 24, grande: 8 }

export function hojasNecesarias(cantidad: number, tamano: TamanoEtiqueta): number {
  return Math.ceil(cantidad / POR_HOJA[tamano])
}
