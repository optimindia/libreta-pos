import { db, type EnCola } from '@/datos/local/db'
import type { Table } from 'dexie'
import { pendientes, marcarSubido, marcarFallido } from '@/datos/local/cola'
import { cliente } from './cliente'
import { aLaNube, deLaNube, type Fila } from './mapeo'
import type { UUID } from '@/dominio/tipos'

export type SubirFn = (item: EnCola) => Promise<void>
export type TraerFn = (tabla: string) => Promise<unknown[]>

const TABLA: Record<EnCola['entidad'], string> = {
  venta: 'ventas',
  producto: 'productos',
  fiado: 'fiados',
  fiadoPago: 'fiado_pagos',
  ingreso: 'ingresos',
  cliente: 'clientes',
}

export async function sincronizar(
  subir: SubirFn,
): Promise<{ subidos: number; fallidos: number }> {
  const cola = await pendientes()
  let subidos = 0
  let fallidos = 0

  for (const item of cola) {
    try {
      await subir(item)
      await marcarSubido(item.id)
      subidos++
    } catch {
      // El dato ya está guardado en el teléfono: un fallo de red
      // no pierde nada, sólo posterga la subida.
      await marcarFallido(item.id)
      fallidos++
    }
  }

  return { subidos, fallidos }
}

/** La subida real contra Supabase. `upsert` hace la operación idempotente:
 *  reintentar la misma venta no la duplica. Una venta se parte en dos tablas,
 *  así que se sube en orden: primero la venta, después sus items. */
export function subirASupabase(negocioId: UUID): SubirFn {
  return async (item) => {
    if (!cliente) throw new Error('nube apagada')
    for (const parte of aLaNube(item.entidad, item.datos, negocioId)) {
      const { error } = await cliente.from(parte.tabla).upsert(parte.filas)
      if (error) throw error
    }
  }
}

const DESTINO: Record<string, () => Table<unknown, unknown>> = {
  productos: () => db.productos as unknown as Table<unknown, unknown>,
  ventas: () => db.ventas as unknown as Table<unknown, unknown>,
  clientes: () => db.clientes as unknown as Table<unknown, unknown>,
  fiados: () => db.fiados as unknown as Table<unknown, unknown>,
  fiado_pagos: () => db.fiadoPagos as unknown as Table<unknown, unknown>,
  ingresos: () => db.ingresos as unknown as Table<unknown, unknown>,
}

/** Primera apertura en un teléfono nuevo: la nube devuelve lo que el
 *  almacenero ya tenía. `bulkPut` pisa por id, así que repetir la bajada
 *  no duplica nada. Una tabla que falla no arrastra a las demás. */
export async function bajarTodo(traer: TraerFn): Promise<number> {
  let escritas = 0
  for (const [tabla, destino] of Object.entries(DESTINO)) {
    try {
      const filas = await traer(tabla)
      if (filas.length === 0) continue
      await destino().bulkPut(filas)
      escritas += filas.length
    } catch {
      // se sigue con la próxima tabla: bajar algo es mejor que no bajar nada
    }
  }
  return escritas
}

/** La bajada real contra Supabase. Las ventas se rearman con sus items,
 *  porque en la base viven en dos tablas y la aplicación las usa juntas:
 *  sin los items no habría forma de calcular la ganancia. */
export const traerDeSupabase: TraerFn = async (tabla) => {
  if (!cliente) throw new Error('nube apagada')

  if (tabla === 'ventas' || tabla === 'ingresos') {
    const tablaItems = tabla === 'ventas' ? 'venta_items' : 'ingreso_items'
    const claveDelPadre = tabla === 'ventas' ? 'venta_id' : 'ingreso_id'

    const [cabeceras, items] = await Promise.all([
      cliente.from(tabla).select('*'),
      cliente.from(tablaItems).select('*'),
    ])
    if (cabeceras.error) throw cabeceras.error
    if (items.error) throw items.error

    return (cabeceras.data ?? []).map((fila) => ({
      ...deLaNube(tabla, fila as Fila),
      items: (items.data ?? [])
        .filter((item) => (item as Fila)[claveDelPadre] === (fila as Fila).id)
        .map((item) => {
          const local = deLaNube(tablaItems, item as Fila) as Fila
          delete local[claveDelPadre === 'venta_id' ? 'ventaId' : 'ingresoId']
          delete local.id
          return local
        }),
    }))
  }

  const { data, error } = await cliente.from(tabla).select('*')
  if (error) throw error
  return (data ?? []).map((fila) => deLaNube(tabla, fila as Fila))
}
