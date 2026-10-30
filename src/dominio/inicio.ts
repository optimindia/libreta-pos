import type { Centavos, Fiado, FiadoPago, Producto, Venta } from './tipos'
import { saldoFiado } from './fiado'
import { estadoVencimiento } from './inteligencia'
import { faltantes } from './stock'
import { formatearPesos, sumar } from './dinero'

/** El saludo de la pantalla de inicio, según la hora del aparato. */
export function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buen día'
  if (hora >= 12 && hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function mismoDia(fecha: number, dia: Date): boolean {
  const f = new Date(fecha)
  return f.getFullYear() === dia.getFullYear() && f.getMonth() === dia.getMonth() && f.getDate() === dia.getDate()
}

/** Lo vendido hoy repartido en franjas de dos horas, de 6 a 22. Lo que se
 *  vende antes de abrir o después de cerrar suma a la primera o a la última
 *  franja: ninguna venta queda afuera del gráfico. */
export function ventasPorFranja(
  ventas: Venta[],
  dia: Date,
  franjas = 8,
  desdeHora = 6,
  horasPorFranja = 2,
): Centavos[] {
  const valores: Centavos[] = Array.from({ length: franjas }, () => 0)
  for (const venta of ventas) {
    if (venta.estado === 'anulada' || !mismoDia(venta.fecha, dia)) continue
    const franja = Math.floor((new Date(venta.fecha).getHours() - desdeHora) / horasPorFranja)
    valores[Math.min(franjas - 1, Math.max(0, franja))] += venta.total
  }
  return valores
}

/** Alto de cada barra en porcentaje. Un día sin ventas deja barras bajas e
 *  iguales; con ventas, la mejor franja llena el gráfico. */
export function alturasDeBarras(valores: Centavos[], minimo = 12, maximo = 100): number[] {
  const mayor = Math.max(0, ...valores)
  return valores.map((valor) => (mayor === 0 ? minimo : Math.max(minimo, Math.round((valor / mayor) * maximo))))
}

/** Posición de la mejor franja, o null si todavía no se vendió nada. */
export function mejorFranja(valores: Centavos[]): number | null {
  const mayor = Math.max(0, ...valores)
  return mayor === 0 ? null : valores.indexOf(mayor)
}

export interface FiadosVencidos {
  cantidad: number
  monto: Centavos
}

/** Cuántos fiados siguen sin pagar pasada su fecha de vencimiento, y cuánta
 *  plata es. Un fiado sin fecha nunca cuenta como vencido. */
export function fiadosVencidos(fiados: Fiado[], pagos: FiadoPago[], ahora: number): FiadosVencidos {
  const vencidos = fiados
    .map((fiado) => ({ fiado, saldo: saldoFiado(fiado, pagos) }))
    .filter(({ fiado, saldo }) => saldo > 0 && estadoVencimiento(fiado.vence, ahora) === 'vencido')
  return { cantidad: vencidos.length, monto: sumar(...vencidos.map(({ saldo }) => saldo)) }
}

export interface PorReponer {
  cantidad: number
  nombres: string[]
}

/** Los productos que llegaron a su mínimo, con los nombres de los más
 *  urgentes para mostrarlos en la tarjeta sin abrir el stock. */
export function porReponer(productos: Producto[], mostrar = 3): PorReponer {
  const faltan = faltantes(productos)
  return { cantidad: faltan.length, nombres: faltan.slice(0, mostrar).map((producto) => producto.nombre) }
}

/** "Coca, Oreo y Fideos": el primer nombre de cada producto, en una frase. */
export function listaCorta(nombres: string[]): string {
  const cortos = nombres.map((nombre) => nombre.trim().split(/\s+/)[0]).filter(Boolean)
  if (cortos.length <= 1) return cortos.join('')
  return `${cortos.slice(0, -1).join(', ')} y ${cortos[cortos.length - 1]}`
}

export interface DetalleFranja {
  desde: number
  hasta: number
  etiqueta: string
  monto: Centavos
  cantidad: number
}

/** Lo mismo que `ventasPorFranja`, pero con el horario escrito y cuántas
 *  ventas hubo en cada franja: lo que se muestra al pasar por una barra. */
export function detalleFranjas(
  ventas: Venta[],
  dia: Date,
  franjas = 8,
  desdeHora = 6,
  horasPorFranja = 2,
): DetalleFranja[] {
  const montos = ventasPorFranja(ventas, dia, franjas, desdeHora, horasPorFranja)
  const cantidades: number[] = Array.from({ length: franjas }, () => 0)
  for (const venta of ventas) {
    if (venta.estado === 'anulada' || !mismoDia(venta.fecha, dia)) continue
    const franja = Math.floor((new Date(venta.fecha).getHours() - desdeHora) / horasPorFranja)
    cantidades[Math.min(franjas - 1, Math.max(0, franja))] += 1
  }
  return montos.map((monto, i) => {
    const desde = desdeHora + i * horasPorFranja
    const hasta = desde + horasPorFranja
    return { desde, hasta, etiqueta: `${desde} a ${hasta} h`, monto, cantidad: cantidades[i] }
  })
}

/** Productos vendidos hoy por menos de lo que cuestan (sin repetir). Explica
 *  una ganancia negativa: o hubo un descuento grande o el costo está mal cargado. */
export function porDebajoDelCosto(ventas: Venta[], dia: Date): string[] {
  const nombres = new Set<string>()
  for (const venta of ventas) {
    if (venta.estado === 'anulada' || !mismoDia(venta.fecha, dia)) continue
    for (const item of venta.items) if (item.costo > item.precio) nombres.add(item.nombre)
  }
  return [...nombres]
}

export interface Tarea {
  id: 'fiados-vencidos' | 'fiado-viejo' | 'bajo-costo' | 'reponer' | 'sin-productos'
  tono: 'coral' | 'ambar' | 'verde'
  texto: string
  detalle: string
  accion: string
  href: string
}

export interface DatosTareas {
  esDueno: boolean
  hayFiados: boolean
  hayStock: boolean
  cantidadProductos: number
  vencidos: FiadosVencidos
  /** Deudas ordenadas de mayor a menor, con el nombre del cliente. */
  deudas: Array<{ nombre: string; saldo: Centavos; diasDelMasViejo: number }>
  reponer: PorReponer
  bajoCosto: string[]
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Lo que conviene hacer ahora, de lo más urgente a lo menos, dicho en
 *  palabras y con la acción que lo resuelve. Vacío = todo en orden. */
export function tareasDeHoy(datos: DatosTareas): Tarea[] {
  const tareas: Tarea[] = []
  const [mayor] = datos.deudas

  if (datos.esDueno && datos.hayStock && datos.cantidadProductos === 0) {
    tareas.push({
      id: 'sin-productos', tono: 'verde', texto: 'Cargá tus productos para empezar a vender',
      detalle: 'Con el precio y cuántos tenés, Libreta controla el stock sola.', accion: 'Cargar productos', href: '/stock',
    })
  }
  if (datos.hayFiados && datos.vencidos.cantidad > 0) {
    tareas.push({
      id: 'fiados-vencidos', tono: 'coral',
      texto: `${plural(datos.vencidos.cantidad, 'fiado vencido', 'fiados vencidos')} por ${formatearPesos(datos.vencidos.monto)}`,
      detalle: mayor ? `El que más debe es ${mayor.nombre}: ${formatearPesos(mayor.saldo)}.` : 'Ya pasó la fecha que acordaron.',
      accion: 'Cobrar', href: '/fiados',
    })
  } else if (datos.hayFiados && mayor && mayor.diasDelMasViejo >= 7) {
    tareas.push({
      id: 'fiado-viejo', tono: 'coral', texto: `${mayor.nombre} te debe ${formatearPesos(mayor.saldo)}`,
      detalle: `Desde hace ${plural(mayor.diasDelMasViejo, 'día', 'días')}. Podés mandarle un recordatorio.`,
      accion: 'Recordar', href: '/fiados',
    })
  }
  if (datos.esDueno && datos.bajoCosto.length > 0) {
    tareas.push({
      id: 'bajo-costo', tono: 'ambar', texto: `Vendiste por debajo del costo: ${listaCorta(datos.bajoCosto)}`,
      detalle: 'O hubo un descuento grande o el costo está mal cargado.', accion: 'Revisar costos', href: '/stock',
    })
  }
  if (datos.hayStock && datos.reponer.cantidad > 0) {
    tareas.push({
      id: 'reponer', tono: 'ambar', texto: `Se te están por acabar ${listaCorta(datos.reponer.nombres)}`,
      detalle: `${plural(datos.reponer.cantidad, 'producto llegó', 'productos llegaron')} a su mínimo.`,
      accion: 'Ver qué pedir', href: '/stock',
    })
  }
  return tareas
}
