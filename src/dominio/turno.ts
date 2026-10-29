import type { Centavos, Cierre, FiadoPago, UUID, Venta } from './tipos'
import { esperadoEnCaja, movimientosEfectivo } from './caja'
import { sumar } from './dinero'

/** Valor del filtro para lo que no tiene vendedor registrado (ventas viejas). */
export const SIN_DATO = '__sin_dato__'

type ConVendedor = { vendidoPor?: UUID | null } | { usuarioId?: UUID | null }

function quien(fila: ConVendedor): UUID | null {
  return ('vendidoPor' in fila ? fila.vendidoPor : (fila as { usuarioId?: UUID | null }).usuarioId) ?? null
}

/** `null` deja todo; SIN_DATO deja lo que no trae vendedor; un id, lo suyo. */
export function filtrarPorVendedor<T extends ConVendedor>(filas: T[], vendedor: string | null): T[] {
  if (vendedor === null) return filas
  return filas.filter((fila) => {
    const autor = quien(fila)
    return vendedor === SIN_DATO ? autor === null : autor === vendedor
  })
}

export function vendedoresPresentes(filas: ConVendedor[]): { ids: UUID[]; haySinDato: boolean } {
  const ids = new Set<UUID>()
  let haySinDato = false
  for (const fila of filas) {
    const autor = quien(fila)
    if (autor === null) haySinDato = true
    else ids.add(autor)
  }
  return { ids: [...ids].sort(), haySinDato }
}

/** El dueño no puede leer los nombres de otros usuarios (la base sólo deja
 *  ver el propio vínculo), así que el resto se distingue por un sufijo corto. */
export function etiquetaVendedor(
  id: string | null | undefined,
  yo: { usuarioId?: UUID; nombre?: string | null },
): string {
  if (!id || id === SIN_DATO) return 'Sin dato'
  if (id === yo.usuarioId) return yo.nombre?.trim() || 'Vos'
  return `Vendedor ${id.slice(-4)}`
}

function inicioDelDia(ahora: number): number {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Desde cuándo cuenta el turno: el último cierre de turno del vendedor, pero
 *  nunca antes del comienzo de hoy (sin cierres previos no se suma todo el
 *  historial). */
export function desdeDelTurno(cierres: Cierre[], usuarioId: UUID, ahora: number): number {
  const ultimo = cierres
    .filter((c) => c.alcance === 'turno' && c.usuarioId === usuarioId && c.fecha <= ahora)
    .reduce((max, c) => Math.max(max, c.fecha), 0)
  return Math.max(ultimo, inicioDelDia(ahora))
}

export interface ResumenTurno {
  ventasEfectivo: Centavos
  pagosFiadoEfectivo: Centavos
  esperado: Centavos
  cantidadVentas: number
  vendido: Centavos
}

/** Lo del turno de UN vendedor: nada de costos ni ganancia, ni fondo ni
 *  movimientos manuales (el vendedor no los maneja). */
export function resumenTurno(
  ventas: Venta[],
  pagos: FiadoPago[],
  usuarioId: UUID,
  desde: number,
  hasta: number,
): ResumenTurno {
  const suyas = filtrarPorVendedor(ventas, usuarioId).filter((v) => v.fecha > desde && v.fecha <= hasta && v.estado !== 'anulada')
  const movimientos = movimientosEfectivo(
    filtrarPorVendedor(ventas, usuarioId),
    filtrarPorVendedor(pagos, usuarioId),
    desde,
    hasta,
  )
  return {
    ventasEfectivo: movimientos.ventasEfectivo,
    pagosFiadoEfectivo: movimientos.pagosFiadoEfectivo,
    esperado: esperadoEnCaja(0, movimientos),
    cantidadVentas: suyas.length,
    vendido: sumar(...suyas.map((v) => v.total)),
  }
}

export interface FilaVendedor {
  /** Id del vendedor o SIN_DATO. */
  vendedor: string
  cantidadVentas: number
  vendido: Centavos
  efectivo: Centavos
  cierre: { esperado: Centavos; contado: Centavos; diferencia: Centavos } | null
}

/** El día del dueño, vendedor por vendedor (sin ganancias: eso va en Plata). */
export function desgloseDelDia(
  ventas: Venta[],
  pagos: FiadoPago[],
  cierres: Cierre[],
  ahora: number,
): FilaVendedor[] {
  const desde = inicioDelDia(ahora) - 1
  const delDia = ventas.filter((v) => v.fecha > desde && v.fecha <= ahora)
  const pagosDelDia = pagos.filter((p) => p.fecha > desde && p.fecha <= ahora)
  const { ids, haySinDato } = vendedoresPresentes([...delDia, ...pagosDelDia])
  const claves = [...ids, ...(haySinDato ? [SIN_DATO] : [])]
  return claves.map((vendedor) => {
    const suyas = filtrarPorVendedor(delDia, vendedor).filter((v) => v.estado !== 'anulada')
    const efectivo = sumar(
      ...filtrarPorVendedor(delDia, vendedor).filter((v) => v.medioPago === 'efectivo').map((v) => v.total),
      ...filtrarPorVendedor(pagosDelDia, vendedor).map((p) => p.monto),
    )
    const ultimo = cierres
      .filter((c) => c.alcance === 'turno' && c.fecha > desde && c.fecha <= ahora && (c.usuarioId ?? SIN_DATO) === vendedor)
      .sort((a, b) => b.fecha - a.fecha)[0]
    return {
      vendedor,
      cantidadVentas: suyas.length,
      vendido: sumar(...suyas.map((v) => v.total)),
      efectivo,
      cierre: ultimo ? { esperado: ultimo.esperado, contado: ultimo.contado, diferencia: ultimo.contado - ultimo.esperado } : null,
    }
  })
}
