import type { Centavos, ItemVenta, Producto, UUID, Venta } from './tipos'
import { agregarProducto, precioVigente } from './ticket'

/** Cuántas ventas se pueden tener abiertas a la vez en un aparato. */
export const MAX_VENTAS_ABIERTAS = 10
export const LARGO_NOMBRE_VENTA = 40

export type Descuento =
  | { tipo: 'pesos'; valor: Centavos }
  | { tipo: 'porcentaje'; valor: number }

/** Una venta que todavía no se cobró. Los renglones guardan el precio de
 *  lista; los descuentos van aparte y recién se aplican al cobrar, así se
 *  pueden cambiar o sacar sin perder el precio original. */
export interface VentaAbierta {
  id: UUID
  /** Nombre o nota opcional ("Doña Rosa"). */
  nombre: string
  items: ItemVenta[]
  descuentoItems: Record<UUID, Descuento>
  descuentoTotal: Descuento | null
  creada: number
  actualizada: number
}

export function ventaNueva(id: UUID, ahora: number = Date.now()): VentaAbierta {
  return { id, nombre: '', items: [], descuentoItems: {}, descuentoTotal: null, creada: ahora, actualizada: ahora }
}

/** Una venta vacía y sin nombre no vale la pena guardarla. */
export function ventaConContenido(venta: VentaAbierta): boolean {
  return venta.items.length > 0 || venta.nombre.trim() !== ''
}

export function nombreDeVenta(venta: VentaAbierta, posicion: number): string {
  const nombre = venta.nombre.trim()
  return nombre === '' ? `Venta ${posicion + 1}` : nombre
}

export function limpiarNombre(texto: string): string {
  return texto.replace(/\s+/g, ' ').slice(0, LARGO_NOMBRE_VENTA)
}

/** Cuánto se descuenta de `base`. Nunca deja el monto en cero ni en negativo:
 *  lo máximo es dejar un centavo. */
export function importeDescuento(base: Centavos, descuento: Descuento): Centavos {
  if (base <= 1 || !Number.isFinite(descuento.valor) || descuento.valor <= 0) return 0
  const bruto = descuento.tipo === 'porcentaje'
    ? Math.round((base * Math.min(descuento.valor, 99)) / 100)
    : Math.round(descuento.valor)
  return Math.min(Math.max(bruto, 0), base - 1)
}

function totalDeItems(items: ItemVenta[]): Centavos {
  return items.reduce((suma, item) => suma + Math.round(item.precio * item.cantidad), 0)
}

/** Baja el precio unitario de un renglón para descontar `monto` en total. */
function descontarRenglon(item: ItemVenta, monto: Centavos): ItemVenta {
  const porUnidad = Math.floor(monto / item.cantidad)
  return { ...item, precio: Math.max(1, item.precio - porUnidad) }
}

/** Los renglones tal como se cobran: primero el descuento de cada renglón y
 *  después el de toda la venta, repartido en proporción a lo que pesa cada
 *  renglón. Lo que se muestra y lo que se registra sale de acá. */
export function itemsParaCobrar(venta: Pick<VentaAbierta, 'items' | 'descuentoItems' | 'descuentoTotal'>): ItemVenta[] {
  const conDescuentoPropio = venta.items.map((item) => {
    const descuento = venta.descuentoItems[item.productoId]
    if (!descuento) return item
    return descontarRenglon(item, importeDescuento(Math.round(item.precio * item.cantidad), descuento))
  })
  if (!venta.descuentoTotal) return conDescuentoPropio

  const base = totalDeItems(conDescuentoPropio)
  const aDescontar = importeDescuento(base, venta.descuentoTotal)
  if (aDescontar <= 0) return conDescuentoPropio

  let repartido = 0
  return conDescuentoPropio.map((item, indice) => {
    const renglon = Math.round(item.precio * item.cantidad)
    const ultimo = indice === conDescuentoPropio.length - 1
    const parte = ultimo ? aDescontar - repartido : Math.round((aDescontar * renglon) / base)
    const tope = Math.max(0, renglon - item.cantidad)
    const real = Math.min(Math.max(parte, 0), tope)
    repartido += real
    return descontarRenglon(item, real)
  })
}

/** Cuánto se ahorra el cliente con los descuentos de esta venta. */
export function ahorroTotal(venta: Pick<VentaAbierta, 'items' | 'descuentoItems' | 'descuentoTotal'>): Centavos {
  return totalDeItems(venta.items) - totalDeItems(itemsParaCobrar(venta))
}

/** Si cambian los renglones, los descuentos de lo que ya no está se van. */
export function conRenglones(venta: VentaAbierta, items: ItemVenta[], ahora: number = Date.now()): VentaAbierta {
  const vigentes = new Set(items.map((item) => item.productoId))
  const descuentoItems = Object.fromEntries(
    Object.entries(venta.descuentoItems).filter(([productoId]) => vigentes.has(productoId)),
  )
  return {
    ...venta,
    items,
    descuentoItems,
    descuentoTotal: items.length === 0 ? null : venta.descuentoTotal,
    actualizada: ahora,
  }
}

/** Los productos que más salieron: por unidades, entre ventas completadas
 *  desde `desde`. Sólo devuelve los que existen y siguen con stock. */
export function masVendidos(ventas: Venta[], productos: Producto[], desde: number, limite = 6): Producto[] {
  const unidades = new Map<UUID, number>()
  for (const venta of ventas) {
    if (venta.estado !== 'completada' || venta.fecha < desde) continue
    for (const item of venta.items) unidades.set(item.productoId, (unidades.get(item.productoId) ?? 0) + item.cantidad)
  }
  return productos
    .filter((producto) => unidades.has(producto.id) && producto.stock > 0 && precioVigente(producto) > 0)
    .sort((a, b) => (unidades.get(b.id) ?? 0) - (unidades.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
}

export interface Repeticion {
  items: ItemVenta[]
  /** Nombres de lo que no se pudo cargar (no existe, sin stock o sin precio). */
  omitidos: string[]
}

/** Vuelve a armar los renglones de una venta anterior con los precios de hoy
 *  y sin pasarse del stock que hay. */
export function repetirVenta(
  venta: Venta,
  productos: Producto[],
  disponible: (producto: Producto) => number,
): Repeticion {
  let items: ItemVenta[] = []
  const omitidos: string[] = []
  for (const original of venta.items) {
    const producto = productos.find((candidato) => candidato.id === original.productoId)
    if (!producto || precioVigente(producto) <= 0) {
      omitidos.push(original.nombre)
      continue
    }
    const cantidad = Math.min(original.cantidad, disponible(producto))
    if (cantidad <= 0) {
      omitidos.push(original.nombre)
      continue
    }
    if (cantidad < original.cantidad) omitidos.push(`${original.nombre} (solo ${cantidad} de ${original.cantidad})`)
    items = agregarProducto(items, producto, cantidad)
  }
  return { items, omitidos }
}
