import type { Producto, UUID, Venta } from './tipos'

const DIA_EN_MS = 24 * 60 * 60 * 1000
const VENTANA_DIAS = 14
const UMBRAL_AVISO_DIAS = 7
const DIAS_A_COMPRAR = 14

export interface SugerenciaCompra {
  producto: Producto
  diasRestantes: number | null
  cantidadSugerida: number
}

export function ventaDiariaPromedio(
  productoId: UUID,
  ventas: Venta[],
  ahora: number,
  dias: number = VENTANA_DIAS,
): number {
  const desde = ahora - dias * DIA_EN_MS
  let unidades = 0
  for (const venta of ventas) {
    if (venta.fecha < desde) continue
    for (const item of venta.items) {
      if (item.productoId === productoId) unidades += item.cantidad
    }
  }
  return unidades / dias
}

export function diasHastaAgotar(
  producto: Producto,
  ventas: Venta[],
  ahora: number,
): number | null {
  const porDia = ventaDiariaPromedio(producto.id, ventas, ahora)
  if (porDia === 0) return null
  return Math.floor(Math.max(0, producto.stock) / porDia)
}

export function listaDeCompra(
  productos: Producto[],
  ventas: Venta[],
  ahora: number,
): SugerenciaCompra[] {
  const sugerencias: SugerenciaCompra[] = []

  for (const producto of productos) {
    const diasRestantes = diasHastaAgotar(producto, ventas, ahora)
    const seAgotaPronto = diasRestantes !== null && diasRestantes <= UMBRAL_AVISO_DIAS
    const faltanteSinDatos =
      diasRestantes === null && producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo

    if (!seAgotaPronto && !faltanteSinDatos) continue

    const porDia = ventaDiariaPromedio(producto.id, ventas, ahora)
    const cantidadSugerida =
      porDia > 0
        ? Math.max(1, Math.ceil(porDia * DIAS_A_COMPRAR - producto.stock))
        : Math.max(1, producto.stockMinimo - producto.stock)

    sugerencias.push({ producto, diasRestantes, cantidadSugerida })
  }

  return sugerencias.sort((a, b) => {
    if (a.diasRestantes === null) return -1
    if (b.diasRestantes === null) return 1
    return a.diasRestantes - b.diasRestantes
  })
}
