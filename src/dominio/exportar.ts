// Exportación a CSV pensada para Excel en castellano (Argentina): separador
// ";", coma decimal, fechas dd/mm/aaaa hh:mm en horario argentino, BOM UTF-8
// y celdas a prueba de inyección de fórmulas. Todo puro: sin Dexie ni DOM.

import type { Centavos, Cliente, Fiado, FiadoPago, MedioPago, Producto, Venta } from './tipos'
import { saldoFiado } from './fiado'

export type Celda = string | number | null | undefined

const SEPARADOR = ';'
const SALTO = '\r\n'
const BOM = '﻿'
/** Argentina no tiene horario de verano: UTC-3 todo el año. */
const DESFASE_AR_MS = 3 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000

/** Texto que Excel/Sheets/LibreOffice interpretarían como fórmula. */
const PARECE_FORMULA = /^(?:[\t\r]|\s*[=+\-@])/

/** Escapa una celda. Los números los generamos nosotros y van tal cual; el
 *  texto que viene de personas (nombres, motivos, referencias) se neutraliza
 *  si empieza como una fórmula, y se entrecomilla si hace falta. */
export function escaparCelda(valor: Celda): string {
  if (valor === null || valor === undefined) return ''
  let texto = String(valor)
  if (typeof valor === 'string' && PARECE_FORMULA.test(texto)) texto = `'${texto}`
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** Filas -> archivo listo para guardar: BOM, ";" y CRLF. */
export function armarCsv(filas: Celda[][]): string {
  return BOM + filas.map((fila) => fila.map(escaparCelda).join(SEPARADOR) + SALTO).join('')
}

const dos = (n: number) => String(n).padStart(2, '0')

/** dd/mm/aaaa hh:mm en horario de Argentina, sin depender del huso del aparato. */
export function fechaArgentina(epoch: number): string {
  const f = new Date(epoch - DESFASE_AR_MS)
  return `${dos(f.getUTCDate())}/${dos(f.getUTCMonth() + 1)}/${f.getUTCFullYear()} ${dos(f.getUTCHours())}:${dos(f.getUTCMinutes())}`
}

/** aaaa-mm-dd (día argentino), para nombres de archivo. */
export function diaArgentino(epoch: number): string {
  const f = new Date(epoch - DESFASE_AR_MS)
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`
}

/** 420050 -> "4200,50". Sin separador de miles, para que Excel lo lea como número. */
export function decimalArgentino(centavos: Centavos): string {
  const total = Math.round(Math.abs(centavos))
  const signo = centavos < 0 && total > 0 ? '-' : ''
  return `${signo}${Math.floor(total / 100)},${dos(total % 100)}`
}

function inicioDeDia(texto: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null
  return fecha.getTime() + DESFASE_AR_MS
}

/** Rango inclusivo de días "aaaa-mm-dd" (como los da <input type="date">) en
 *  horario argentino. Vacío = sin límite. Devuelve null si es inválido. */
export function rangoDeDiasArgentina(desde: string, hasta: string): { desde: number; hasta: number } | null {
  const ini = desde === '' ? -Infinity : inicioDeDia(desde)
  const fin = hasta === '' ? null : inicioDeDia(hasta)
  if (ini === null || (hasta !== '' && fin === null)) return null
  const topeFin = fin === null ? Infinity : fin + DIA_MS - 1
  if (ini > topeFin) return null
  return { desde: ini, hasta: topeFin }
}

export function filtrarVentasPorRango(ventas: Venta[], rango: { desde: number; hasta: number }): Venta[] {
  return ventas.filter((venta) => venta.fecha >= rango.desde && venta.fecha <= rango.hasta)
}

export function nombreArchivoCsv(que: 'ventas' | 'productos' | 'fiados', ahora: number): string {
  return `libreta-${que}-${diaArgentino(ahora)}.csv`
}

const MEDIOS: Record<MedioPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', fiado: 'Fiado',
}

export function csvVentas(ventas: Venta[], clientes: Cliente[]): string {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]))
  const ordenadas = [...ventas].sort((a, b) => b.fecha - a.fecha)
  return armarCsv([
    ['Fecha', 'Medio de pago', 'Total', 'Estado', 'Productos', 'Cliente', 'Motivo de anulación', 'Referencia de pago', 'ID'],
    ...ordenadas.map((v) => [
      fechaArgentina(v.fecha),
      MEDIOS[v.medioPago] ?? v.medioPago,
      decimalArgentino(v.total),
      v.estado === 'anulada' ? 'Anulada' : 'Completada',
      v.items.map((item) => `${item.cantidad} x ${item.nombre}`).join(' | '),
      v.clienteId ? (nombres.get(v.clienteId) ?? '') : '',
      v.motivoAnulacion ?? '',
      v.referenciaPago ?? '',
      v.id,
    ]),
  ])
}

export function csvProductos(productos: Producto[]): string {
  const vivos = productos.filter((p) => !p.eliminadoEn)
  return armarCsv([
    ['Nombre', 'Código de barras', 'Categoría', 'Costo', 'Precio', 'Stock', 'Stock mínimo'],
    ...vivos.map((p) => [
      p.nombre, p.codigoBarras ?? '', p.categoria ?? '',
      decimalArgentino(p.costo), decimalArgentino(p.precio), p.stock, p.stockMinimo,
    ]),
  ])
}

export function csvFiados(fiados: Fiado[], pagos: FiadoPago[], clientes: Cliente[]): string {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]))
  const ordenados = [...fiados].sort((a, b) => a.fecha - b.fecha)
  return armarCsv([
    ['Cliente', 'Fecha', 'Vence', 'Monto', 'Pagado', 'Saldo', 'Estado'],
    ...ordenados.map((f) => {
      const pagado = pagos.filter((p) => p.fiadoId === f.id).reduce((suma, p) => suma + p.monto, 0)
      const saldo = saldoFiado(f, pagos)
      return [
        nombres.get(f.clienteId) ?? 'Cliente borrado',
        fechaArgentina(f.fecha),
        f.vence ? fechaArgentina(f.vence) : '',
        decimalArgentino(f.monto),
        decimalArgentino(pagado),
        decimalArgentino(saldo),
        f.anuladoEn ? 'Anulado' : saldo === 0 ? 'Pagado' : 'Pendiente',
      ]
    }),
  ])
}
