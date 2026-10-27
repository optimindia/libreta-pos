import { db } from './db'
import { normalizarFunciones } from '@/dominio/funciones'
import type { PreferenciasNegocio } from '@/dominio/tipos'

export interface RespaldoLocal {
  version: 1
  creadoEn: number
  productos: unknown[]
  ventas: unknown[]
  clientes: unknown[]
  fiados: unknown[]
  fiadoPagos: unknown[]
  ingresos: unknown[]
  cierres: unknown[]
  /** Opcional para seguir abriendo copias creadas antes del control de caja. */
  movimientosCaja?: unknown[]
  /** Opcional para que las copias anteriores sigan siendo compatibles. */
  pedidos?: unknown[]
  /** Opcional para que las copias anteriores sigan siendo compatibles. */
  preferencias?: unknown[]
  negocio: unknown[]
}

const TABLAS = ['productos', 'ventas', 'clientes', 'fiados', 'fiadoPagos', 'ingresos', 'cierres', 'negocio'] as const

export async function crearRespaldoLocal(): Promise<RespaldoLocal> {
  const filas = await Promise.all([...TABLAS.map((tabla) => db[tabla].toArray()), db.movimientosCaja.toArray(), db.pedidos.toArray(), db.preferencias.toArray()])
  return {
    version: 1,
    creadoEn: Date.now(),
    productos: filas[0], ventas: filas[1], clientes: filas[2], fiados: filas[3],
    fiadoPagos: filas[4], ingresos: filas[5], cierres: filas[6], negocio: filas[7], movimientosCaja: filas[8], pedidos: filas[9], preferencias: filas[10],
  }
}

function esRegistro(valor: unknown): valor is { id: string } {
  return typeof valor === 'object' && valor !== null && typeof (valor as { id?: unknown }).id === 'string'
}

function esLista(valor: unknown): valor is unknown[] {
  return Array.isArray(valor) && valor.every(esRegistro)
}

export function validarRespaldoLocal(valor: unknown): valor is RespaldoLocal {
  if (typeof valor !== 'object' || valor === null) return false
  const respaldo = valor as Partial<RespaldoLocal>
  return respaldo.version === 1 && typeof respaldo.creadoEn === 'number' &&
    TABLAS.every((tabla) => esLista(respaldo[tabla])) &&
    (respaldo.movimientosCaja === undefined || esLista(respaldo.movimientosCaja)) &&
    (respaldo.pedidos === undefined || esLista(respaldo.pedidos)) &&
    (respaldo.preferencias === undefined || esLista(respaldo.preferencias))
}

export async function restaurarRespaldoLocal(respaldo: RespaldoLocal): Promise<number> {
  if (!validarRespaldoLocal(respaldo)) throw new Error('respaldo inválido')
  let restauradas = 0
  await db.transaction('rw', [db.productos, db.ventas, db.clientes, db.fiados, db.fiadoPagos, db.ingresos, db.cierres, db.movimientosCaja, db.pedidos, db.preferencias, db.negocio], async () => {
    const actual = await db.negocio.get('unico')
    const actualPreferencias = await db.preferencias.get('unico')
    if (respaldo.productos.length > 0) { await db.productos.bulkPut(respaldo.productos as never[]); restauradas += respaldo.productos.length }
    if (respaldo.ventas.length > 0) { await db.ventas.bulkPut(respaldo.ventas as never[]); restauradas += respaldo.ventas.length }
    if (respaldo.clientes.length > 0) { await db.clientes.bulkPut(respaldo.clientes as never[]); restauradas += respaldo.clientes.length }
    if (respaldo.fiados.length > 0) { await db.fiados.bulkPut(respaldo.fiados as never[]); restauradas += respaldo.fiados.length }
    if (respaldo.fiadoPagos.length > 0) { await db.fiadoPagos.bulkPut(respaldo.fiadoPagos as never[]); restauradas += respaldo.fiadoPagos.length }
    if (respaldo.ingresos.length > 0) { await db.ingresos.bulkPut(respaldo.ingresos as never[]); restauradas += respaldo.ingresos.length }
    if (respaldo.cierres.length > 0) { await db.cierres.bulkPut(respaldo.cierres as never[]); restauradas += respaldo.cierres.length }
    if (respaldo.movimientosCaja && respaldo.movimientosCaja.length > 0) { await db.movimientosCaja.bulkPut(respaldo.movimientosCaja as never[]); restauradas += respaldo.movimientosCaja.length }
    if (respaldo.pedidos && respaldo.pedidos.length > 0) { await db.pedidos.bulkPut(respaldo.pedidos as never[]); restauradas += respaldo.pedidos.length }
    const filaPreferencias = respaldo.preferencias?.[0] as Partial<PreferenciasNegocio> | undefined
    if (
      filaPreferencias &&
      typeof filaPreferencias.actualizadoEn === 'number' &&
      (!actualPreferencias || actualPreferencias.actualizadoEn <= filaPreferencias.actualizadoEn)
    ) {
      await db.preferencias.put({
        id: 'unico',
        negocioId: actual?.negocioId ?? filaPreferencias.negocioId,
        funciones: normalizarFunciones(filaPreferencias.funciones),
        actualizadoEn: filaPreferencias.actualizadoEn,
      })
      restauradas++
    }
    const filaNegocio = respaldo.negocio[0]
    if (filaNegocio) {
      await db.negocio.put({
        ...(filaNegocio as object),
        ...(actual ?? {}),
        ...(filaNegocio as object),
        negocioId: actual?.negocioId ?? (filaNegocio as { negocioId?: string }).negocioId,
      } as never)
      restauradas++
    }
  })
  return restauradas
}
