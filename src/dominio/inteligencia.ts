import type { Centavos, Cliente, Producto, UUID, Venta } from './tipos'
import { multiplicar, sumar } from './dinero'

const DIA_EN_MS = 24 * 60 * 60 * 1000

export type EstadoVencimiento = 'sin-vencimiento' | 'al-dia' | 'vence-pronto' | 'vencido'
export type RiesgoFiado = 'sin-deuda' | 'bajo' | 'medio' | 'alto'

export interface AlertaProducto {
  producto: Producto
  alertas: string[]
}

export interface PuntoSerie {
  fecha: number
  etiqueta: string
  vendido: Centavos
  ganancia: Centavos
  ventas: number
}

export interface ComparacionPeriodo {
  actual: Centavos
  anterior: Centavos
  delta: Centavos
  porcentaje: number
  ventasActuales: number
  ventasAnteriores: number
}

export interface PronosticoVentas {
  promedioDiario: Centavos
  proyectado: Centavos
  ventanaDias: number
  horizonteDias: number
  ventasEnVentana: number
  confianza: 'baja' | 'media' | 'alta'
}

export interface RotacionStock {
  unidadesVendidas: number
  promedioDiario: number
  diasCobertura: number | null
}

export interface ClienteValioso {
  clienteId: UUID
  nombre: string
  telefono: string | null
  ventas: number
  gastado: Centavos
  ultimoCompra: number
  ticketPromedio: Centavos
}

function inicioDelDia(fecha: Date): number {
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  return inicio.getTime()
}

function claveDia(fecha: Date): string {
  const año = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

/** Días enteros hasta el vencimiento. Cero significa que vence hoy. */
export function diasParaVencer(vence: number | null, ahora: number = Date.now()): number | null {
  if (vence === null) return null
  return Math.ceil((inicioDelDia(new Date(vence)) - inicioDelDia(new Date(ahora))) / DIA_EN_MS)
}

export function estadoVencimiento(
  vence: number | null,
  ahora: number = Date.now(),
  umbralDias: number = 3,
): EstadoVencimiento {
  const dias = diasParaVencer(vence, ahora)
  if (dias === null) return 'sin-vencimiento'
  if (dias < 0) return 'vencido'
  if (dias <= umbralDias) return 'vence-pronto'
  return 'al-dia'
}

export function etiquetaVencimiento(
  vence: number | null,
  ahora: number = Date.now(),
): string {
  const dias = diasParaVencer(vence, ahora)
  if (dias === null) return 'Sin fecha de vencimiento'
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/** Riesgo simple, explicable y accionable: antigüedad y cercanía al límite. */
export function riesgoFiado(
  saldo: Centavos,
  limiteFiado: Centavos | undefined,
  diasMasViejo: number,
): RiesgoFiado {
  if (saldo <= 0) return 'sin-deuda'
  if (diasMasViejo >= 30 || (limiteFiado !== undefined && limiteFiado > 0 && saldo >= limiteFiado)) return 'alto'
  if (diasMasViejo >= 14 || (limiteFiado !== undefined && limiteFiado > 0 && saldo >= limiteFiado * 0.75)) return 'medio'
  return 'bajo'
}

export function porcentajeLimite(saldo: Centavos, limiteFiado: Centavos | undefined): number | null {
  if (!limiteFiado || limiteFiado <= 0) return null
  return Math.round((saldo / limiteFiado) * 100)
}

export function margenProducto(producto: Pick<Producto, 'precio' | 'costo'>): number {
  if (producto.precio <= 0) return 0
  return Math.round(((producto.precio - producto.costo) / producto.precio) * 100)
}

/** Detecta problemas de calidad antes de que se conviertan en una pérdida. */
export function alertasProducto(producto: Producto): string[] {
  const alertas: string[] = []
  if (producto.costo <= 0) alertas.push('Sin costo')
  if (producto.precio <= 0) alertas.push('Sin precio')
  else if (producto.precio < producto.costo) alertas.push('Vende debajo del costo')
  if (producto.stock < 0) alertas.push('Stock negativo')
  else if (producto.stock === 0) alertas.push('Sin stock')
  else if (producto.stock <= producto.stockMinimo) alertas.push('Stock bajo')
  return alertas
}

export function productosConAlertas(productos: Producto[]): AlertaProducto[] {
  return productos
    .map((producto) => ({ producto, alertas: alertasProducto(producto) }))
    .filter((resultado) => resultado.alertas.length > 0)
}

export function serieVentas(
  ventas: Venta[],
  dias: number,
  ahora: number = Date.now(),
): PuntoSerie[] {
  const cantidadDias = Math.max(1, Math.floor(dias))
  const hoy = inicioDelDia(new Date(ahora))
  const puntos = new Map<string, PuntoSerie>()
  for (let indice = cantidadDias - 1; indice >= 0; indice -= 1) {
    const fecha = hoy - indice * DIA_EN_MS
    const date = new Date(fecha)
    puntos.set(claveDia(date), {
      fecha,
      etiqueta: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      vendido: 0,
      ganancia: 0,
      ventas: 0,
    })
  }
  for (const venta of ventas) {
    const punto = puntos.get(claveDia(new Date(venta.fecha)))
    if (!punto) continue
    punto.vendido += venta.total
    punto.ganancia += venta.items.reduce(
      (total, item) => total + multiplicar(item.precio - item.costo, item.cantidad),
      0,
    )
    punto.ventas += 1
  }
  return [...puntos.values()]
}

export function compararPeriodos(
  ventas: Venta[],
  actualDesde: number,
  actualHasta: number,
  anteriorDesde: number,
  anteriorHasta: number,
): ComparacionPeriodo {
  const delPeriodo = (desde: number, hasta: number) => ventas.filter((venta) => venta.fecha >= desde && venta.fecha <= hasta)
  const actuales = delPeriodo(actualDesde, actualHasta)
  const anteriores = delPeriodo(anteriorDesde, anteriorHasta)
  const actual = sumar(...actuales.map((venta) => venta.total))
  const anterior = sumar(...anteriores.map((venta) => venta.total))
  return {
    actual,
    anterior,
    delta: actual - anterior,
    porcentaje: anterior === 0 ? (actual > 0 ? 100 : 0) : Math.round(((actual - anterior) / anterior) * 100),
    ventasActuales: actuales.length,
    ventasAnteriores: anteriores.length,
  }
}

export function pronosticoVentas(
  ventas: Venta[],
  ahora: number = Date.now(),
  ventanaDias: number = 14,
  horizonteDias: number = 7,
): PronosticoVentas {
  const puntos = serieVentas(ventas, ventanaDias, ahora)
  const total = sumar(...puntos.map((punto) => punto.vendido))
  const ventasEnVentana = puntos.reduce((totalPuntos, punto) => totalPuntos + punto.ventas, 0)
  const promedioDiario = Math.round(total / Math.max(1, ventanaDias))
  return {
    promedioDiario,
    proyectado: multiplicar(promedioDiario, Math.max(1, horizonteDias)),
    ventanaDias,
    horizonteDias,
    ventasEnVentana,
    confianza: ventasEnVentana >= 20 ? 'alta' : ventasEnVentana >= 5 ? 'media' : 'baja',
  }
}

export function progresoObjetivo(vendido: Centavos, objetivo: Centavos): {
  porcentaje: number
  restante: Centavos
  cumplido: boolean
} {
  if (objetivo <= 0) return { porcentaje: 0, restante: 0, cumplido: false }
  return {
    porcentaje: Math.min(100, Math.round((vendido / objetivo) * 100)),
    restante: Math.max(0, objetivo - vendido),
    cumplido: vendido >= objetivo,
  }
}

export function rotacionStock(
  producto: Producto,
  ventas: Venta[],
  ahora: number = Date.now(),
  ventanaDias: number = 14,
): RotacionStock {
  const desde = ahora - Math.max(1, ventanaDias) * DIA_EN_MS
  const unidadesVendidas = ventas
    .filter((venta) => venta.fecha >= desde && venta.fecha <= ahora)
    .reduce(
      (total, venta) => total + venta.items
        .filter((item) => item.productoId === producto.id)
        .reduce((subtotal, item) => subtotal + item.cantidad, 0),
      0,
    )
  const promedioDiario = unidadesVendidas / Math.max(1, ventanaDias)
  return {
    unidadesVendidas,
    promedioDiario,
    diasCobertura: promedioDiario > 0 ? Math.floor(Math.max(0, producto.stock) / promedioDiario) : null,
  }
}

export function productosDormidos(
  productos: Producto[],
  ventas: Venta[],
  ahora: number = Date.now(),
  dias: number = 30,
): Producto[] {
  const desde = ahora - Math.max(1, dias) * DIA_EN_MS
  const vendidos = new Set(
    ventas
      .filter((venta) => venta.fecha >= desde && venta.fecha <= ahora)
      .flatMap((venta) => venta.items.map((item) => item.productoId)),
  )
  return productos
    .filter((producto) => producto.stock > 0 && !vendidos.has(producto.id))
    .sort((a, b) => multiplicar(b.costo, b.stock) - multiplicar(a.costo, a.stock))
}

export function clientesValiosos(ventas: Venta[], clientes: Cliente[]): ClienteValioso[] {
  const porCliente = new Map<UUID, ClienteValioso>()
  for (const venta of ventas) {
    if (!venta.clienteId) continue
    const cliente = clientes.find((item) => item.id === venta.clienteId)
    if (!cliente) continue
    const actual = porCliente.get(cliente.id) ?? {
      clienteId: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      ventas: 0,
      gastado: 0,
      ultimoCompra: 0,
      ticketPromedio: 0,
    }
    actual.ventas += 1
    actual.gastado += venta.total
    actual.ultimoCompra = Math.max(actual.ultimoCompra, venta.fecha)
    actual.ticketPromedio = Math.round(actual.gastado / actual.ventas)
    porCliente.set(cliente.id, actual)
  }
  return [...porCliente.values()].sort((a, b) => b.gastado - a.gastado)
}
