import { redondearCantidad } from '@/dominio/cantidad'
import type { Producto, Venta } from '@/dominio/tipos'
import { pesosDeTexto } from '@/dominio/dinero'

export interface ProductoCsv {
  nombre: string
  codigoBarras: string | null
  costo: number
  precio: number
  stock: number
  stockMinimo: number
  categoria?: string
}

function celda(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function productosACsv(productos: Producto[]): string {
  const filas = [
    ['nombre', 'codigo_barras', 'costo', 'precio', 'stock', 'stock_minimo', 'categoria'],
    ...productos.map((producto) => [
      producto.nombre,
      producto.codigoBarras ?? '',
      (producto.costo / 100).toFixed(2),
      (producto.precio / 100).toFixed(2),
      producto.stock,
      producto.stockMinimo,
      producto.categoria ?? '',
    ]),
  ]
  return filas.map((fila) => fila.map(celda).join(';')).join('\n')
}

export function ventasACsv(ventas: Venta[]): string {
  const filas = [
    ['fecha', 'medio_pago', 'total', 'productos', 'cliente_id', 'estado', 'motivo_anulacion', 'referencia_pago'],
    ...ventas.map((venta) => [
      new Date(venta.fecha).toISOString(),
      venta.medioPago,
      (venta.total / 100).toFixed(2),
      venta.items.map((item) => `${item.cantidad} x ${item.nombre}`).join(' | '),
      venta.clienteId ?? '',
      venta.estado ?? 'completada',
      venta.motivoAnulacion ?? '',
      venta.referenciaPago ?? '',
    ]),
  ]
  return filas.map((fila) => fila.map(celda).join(';')).join('\n')
}

/** El separador sale del encabezado: Excel en castellano usa ";", Google
 *  Sheets y Excel en inglés usan ",", y algunos exportan con tabulador. */
function detectarSeparador(encabezado: string): string {
  const fuera = encabezado.replace(/"[^"]*"/g, '')
  const cuenta = (separador: string) => fuera.split(separador).length - 1
  return [';', ',', '\t'].reduce((mejor, separador) => (cuenta(separador) > cuenta(mejor) ? separador : mejor), ';')
}

function separarFila(fila: string, separador = ';'): string[] {
  const celdas: string[] = []
  let actual = ''
  let entreComillas = false
  for (let indice = 0; indice < fila.length; indice += 1) {
    const caracter = fila[indice]
    if (caracter === '"' && fila[indice + 1] === '"' && entreComillas) {
      actual += '"'
      indice += 1
    } else if (caracter === '"') {
      entreComillas = !entreComillas
    } else if (caracter === separador && !entreComillas) {
      celdas.push(actual)
      actual = ''
    } else {
      actual += caracter
    }
  }
  celdas.push(actual)
  return celdas
}

/** Mismo criterio que los formularios: ver pesosDeTexto. */
export const numero = pesosDeTexto

/** Lee el formato que exporta la app y tolera encabezados en español. */
export function productosDesdeCsv(texto: string): ProductoCsv[] {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  const separador = detectarSeparador(lineas[0] ?? '')
  const filas = lineas.map((linea) => separarFila(linea, separador)).filter((fila) => fila.some((celda) => celda.trim() !== ''))
  if (filas.length === 0) return []
  const encabezados = filas[0].map((encabezado) => encabezado.trim().toLowerCase())
  const posicion = (...nombres: string[]) => nombres.map((nombre) => encabezados.indexOf(nombre)).find((indice) => indice >= 0) ?? -1
  const nombre = posicion('nombre', 'producto')
  if (nombre < 0) return []
  const codigo = posicion('codigo_barras', 'codigo', 'código')
  const costo = posicion('costo')
  const precio = posicion('precio')
  const stock = posicion('stock')
  const minimo = posicion('stock_minimo', 'mínimo', 'minimo')
  const categoria = posicion('categoria', 'categoría')
  return filas.slice(1).map((fila) => ({
    nombre: fila[nombre]?.trim() ?? '',
    codigoBarras: codigo >= 0 ? (fila[codigo]?.trim() || null) : null,
    costo: Math.round(Math.max(0, numero(fila[costo])) * 100),
    precio: Math.round(Math.max(0, numero(fila[precio])) * 100),
    stock: Math.max(0, redondearCantidad(numero(fila[stock]))),
    stockMinimo: Math.max(0, redondearCantidad(numero(fila[minimo]))),
    categoria: categoria >= 0 ? fila[categoria]?.trim() || undefined : undefined,
  })).filter((producto) => producto.nombre.length >= 2)
}

export function descargarCsv(nombre: string, contenido: string): void {
  if (typeof document === 'undefined') return
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8' }))
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}
