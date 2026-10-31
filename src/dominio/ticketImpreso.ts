import { formatearCantidad } from './cantidad'
import type { Centavos, MedioPago, Venta } from './tipos'
import { formatearPesos } from './dinero'

/** Ancho del rollo de la impresora térmica, en milímetros. */
export type AnchoPapel = 58 | 80

export interface PreferenciasTicket {
  ancho: AnchoPapel
  leyenda: string
}

export const LEYENDA_INICIAL = 'Gracias por tu compra'
export const LARGO_MAXIMO_LEYENDA = 80
export const PREFERENCIAS_TICKET_INICIALES: PreferenciasTicket = { ancho: 58, leyenda: LEYENDA_INICIAL }

/** Caracteres por renglón en fuente monoespaciada, según el rollo. */
export const COLUMNAS: Record<AnchoPapel, number> = { 58: 32, 80: 48 }

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'QR',
  fiado: 'Fiado',
}

/** Lo guardado puede venir viejo o roto: siempre vuelve algo usable. */
export function normalizarPreferenciasTicket(crudo: unknown): PreferenciasTicket {
  const dato = (typeof crudo === 'object' && crudo !== null ? crudo : {}) as Record<string, unknown>
  const ancho: AnchoPapel = dato.ancho === 80 ? 80 : 58
  const leyenda = typeof dato.leyenda === 'string' ? dato.leyenda.slice(0, LARGO_MAXIMO_LEYENDA) : LEYENDA_INICIAL
  return { ancho, leyenda }
}

/** "29/10/2026 14:05" en horario de Argentina, sin depender de la zona ni del
 *  locale del aparato. */
export function fechaHoraArgentina(epoch: number): string {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(epoch))
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('day')}/${valor('month')}/${valor('year')} ${valor('hour')}:${valor('minute')}`
}

/** Los datos que lleva el ticket. `pagoCon` sólo se conoce al cobrar en
 *  efectivo; después de eso la venta no guarda el vuelto. */
export interface DatosTicket {
  negocio: string
  venta: Pick<Venta, 'fecha' | 'total' | 'medioPago' | 'items'>
  vendedor?: string | null
  pagoCon?: Centavos | null
  leyenda: string
}

export interface ResumenTicket {
  negocio: string
  fecha: string
  renglones: { cantidad: string; nombre: string; importe: string }[]
  total: string
  medioPago: string
  pagoCon: string | null
  vuelto: string | null
  vendedor: string | null
  leyenda: string
}

export function resumenTicket(datos: DatosTicket): ResumenTicket {
  const { venta } = datos
  const entregado = datos.pagoCon ?? null
  const hayVuelto = venta.medioPago === 'efectivo' && entregado !== null && entregado >= venta.total
  return {
    negocio: datos.negocio.trim() || 'Tu almacén',
    fecha: fechaHoraArgentina(venta.fecha),
    renglones: venta.items.map((item) => ({
      cantidad: formatearCantidad(item.cantidad),
      nombre: item.nombre,
      // Redondeo al centavo: cantidades con decimales (kilos) no dejan fracciones.
      importe: formatearPesos(Math.round(item.precio * item.cantidad)),
    })),
    total: formatearPesos(venta.total),
    medioPago: ETIQUETA_MEDIO[venta.medioPago],
    pagoCon: hayVuelto ? formatearPesos(entregado) : null,
    vuelto: hayVuelto ? formatearPesos(entregado - venta.total) : null,
    vendedor: datos.vendedor?.trim() || null,
    leyenda: datos.leyenda.trim(),
  }
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, Math.max(0, largo - 1))}…` : texto
}

function dosColumnas(izquierda: string, derecha: string, columnas: number): string {
  const der = recortar(derecha, columnas - 2)
  const lugar = Math.max(1, columnas - der.length - 1)
  return `${recortar(izquierda, lugar).padEnd(lugar)} ${der}`
}

/** Centra el texto; si no entra en un renglón lo parte por palabras. */
function centrar(texto: string, columnas: number): string {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (candidata.length <= columnas) {
      actual = candidata
      continue
    }
    if (actual) lineas.push(actual)
    actual = recortar(palabra, columnas)
  }
  if (actual) lineas.push(actual)
  return lineas.map((linea) => ' '.repeat(Math.floor((columnas - linea.length) / 2)) + linea).join('\n')
}

/** El mismo ticket como texto plano, para compartir con navigator.share. */
export function textoPlanoTicket(datos: DatosTicket, ancho: AnchoPapel = 58): string {
  const r = resumenTicket(datos)
  const columnas = COLUMNAS[ancho]
  const raya = '-'.repeat(columnas)
  const lineas = [
    centrar(r.negocio, columnas),
    centrar(r.fecha, columnas),
    raya,
    ...r.renglones.map((renglon) => dosColumnas(`${renglon.cantidad} x ${renglon.nombre}`, renglon.importe, columnas)),
    raya,
    dosColumnas('TOTAL', r.total, columnas),
    dosColumnas('Pago', r.medioPago, columnas),
  ]
  if (r.pagoCon && r.vuelto) {
    lineas.push(dosColumnas('Pagó con', r.pagoCon, columnas), dosColumnas('Vuelto', r.vuelto, columnas))
  }
  if (r.vendedor) lineas.push(dosColumnas('Vendedor', r.vendedor, columnas))
  if (r.leyenda) lineas.push(raya, centrar(r.leyenda, columnas))
  return lineas.join('\n')
}
