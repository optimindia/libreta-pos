import type { Centavos, Venta } from './tipos'
import { gananciaVenta } from './ganancia'
import { SIN_DATO } from './turno'

/** Lo que el dueño anota de cada vendedor: cómo se llama y qué comisión
 *  cobra (porcentaje sobre lo vendido). */
export interface ConfigVendedor {
  nombre?: string
  comision?: number
}

export type ConfigVendedores = Record<string, ConfigVendedor>

export interface RendimientoVendedor {
  vendedor: string
  cantidadVentas: number
  vendido: Centavos
  ganancia: Centavos
  ticketPromedio: Centavos
  /** Porcentaje de lo vendido del período que hizo este vendedor. */
  participacion: number
  comision: Centavos
  porcentajeComision: number
}

/** Cuánto vendió cada uno entre `desde` y `hasta`, con su comisión. El que
 *  más vendió primero. Las anuladas no cuentan. */
export function rendimientoPorVendedor(ventas: Venta[], desde: number, hasta: number, config: ConfigVendedores = {}): RendimientoVendedor[] {
  const grupos = new Map<string, Venta[]>()
  for (const venta of ventas) {
    if (venta.estado === 'anulada' || venta.fecha < desde || venta.fecha > hasta) continue
    const clave = venta.vendidoPor ?? SIN_DATO
    grupos.set(clave, [...(grupos.get(clave) ?? []), venta])
  }
  const totalPeriodo = [...grupos.values()].flat().reduce((total, venta) => total + venta.total, 0)
  return [...grupos.entries()]
    .map(([vendedor, suyas]) => {
      const vendido = suyas.reduce((total, venta) => total + venta.total, 0)
      const porcentajeComision = vendedor === SIN_DATO ? 0 : comisionValida(config[vendedor]?.comision)
      return {
        vendedor,
        cantidadVentas: suyas.length,
        vendido,
        ganancia: suyas.reduce((total, venta) => total + gananciaVenta(venta), 0),
        ticketPromedio: Math.round(vendido / suyas.length / 100) * 100,
        participacion: totalPeriodo > 0 ? Math.round((vendido / totalPeriodo) * 100) : 0,
        comision: Math.round((vendido * porcentajeComision) / 100),
        porcentajeComision,
      }
    })
    .sort((a, b) => b.vendido - a.vendido)
}

export function comisionValida(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= 50 ? Math.round(valor * 10) / 10 : 0
}

/** Sólo nombres cortos y comisiones razonables: lo que viene de la nube
 *  puede ser de otra versión. */
export function normalizarVendedores(crudo: unknown): ConfigVendedores | undefined {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return undefined
  const salida: ConfigVendedores = {}
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>).slice(0, 50)) {
    if (!valor || typeof valor !== 'object') continue
    const dato = valor as Record<string, unknown>
    const nombre = typeof dato.nombre === 'string' ? dato.nombre.trim().slice(0, 40) : ''
    const comision = comisionValida(dato.comision)
    if (nombre || comision) salida[id] = { ...(nombre ? { nombre } : {}), ...(comision ? { comision } : {}) }
  }
  return salida
}
