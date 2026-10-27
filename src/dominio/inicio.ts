import type { Centavos, Fiado, FiadoPago, Producto, Venta } from './tipos'
import { saldoFiado } from './fiado'
import { estadoVencimiento } from './inteligencia'
import { faltantes } from './stock'
import { sumar } from './dinero'

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
