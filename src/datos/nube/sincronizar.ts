import { db, type EnCola } from '@/datos/local/db'
import type { Table } from 'dexie'
import { pendientes, marcarSubido, marcarFallido } from '@/datos/local/cola'
import { cliente } from './cliente'
import { aLaNube, deLaNube, preferenciasDeLaNube, type Fila } from './mapeo'
import type { UUID } from '@/dominio/tipos'
import { enTandas, todasLasFilas } from './paginar'

export type SubirFn = (item: EnCola) => Promise<void>
export type TraerFn = (tabla: string) => Promise<unknown[]>

export async function sincronizar(
  subir: SubirFn,
): Promise<{ subidos: number; fallidos: number }> {
  const cola = await pendientes()
  let subidos = 0
  let fallidos = 0

  for (const item of cola) {
    try {
      await subir(item)
      await marcarSubido(item.id, item.creadoEn, item.datos)
      subidos++
    } catch (error) {
      // El dato ya está guardado en el teléfono: un fallo de red
      // no pierde nada, sólo posterga la subida.
      await marcarFallido(item.id, error)
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
    if (item.entidad === 'movimientoStock') {
      const datos = item.datos as { id: string; productoId: UUID; cantidad: number; origen: string; referenciaId?: string }
      const { error } = await cliente.rpc('registrar_movimiento_stock', {
        p_movimiento_id: datos.id,
        p_negocio_id: negocioId,
        p_producto_id: datos.productoId,
        p_cantidad: datos.cantidad,
        p_origen: datos.origen,
        p_referencia_id: datos.referenciaId ?? null,
      })
      if (error) throw error
      return
    }
    if (item.operacion === 'eliminar') {
      const tablas: Record<EnCola['entidad'], string> = {
        producto: 'productos', venta: 'ventas', fiado: 'fiados', fiadoPago: 'fiado_pagos',
        ingreso: 'ingresos', cliente: 'clientes', cierre: 'cierres', movimientoCaja: 'movimientos_caja', movimientoStock: 'movimientos_stock', pedido: 'pedidos', preferencias: 'negocio_configuracion',
      }
      const id = (item.datos as { id?: string }).id
      if (item.entidad !== 'preferencias' && !id) throw new Error('operación de borrado sin id')
      if (item.entidad === 'producto') {
        const eliminadoEn = (item.datos as { eliminadoEn?: number }).eliminadoEn ?? Date.now()
        const { error } = await cliente
          .from(tablas[item.entidad])
          .update({ eliminado_en: new Date(eliminadoEn).toISOString() })
          .eq('id', id)
          .eq('negocio_id', negocioId)
        if (error) throw error
        return
      }
      const consulta = item.entidad === 'preferencias'
        ? cliente.from(tablas[item.entidad]).delete().eq('negocio_id', negocioId)
        : cliente.from(tablas[item.entidad]).delete().eq('id', id).eq('negocio_id', negocioId)
      const { error } = await consulta
      if (error) throw error
      return
    }
    for (const parte of aLaNube(item.entidad, item.datos, negocioId)) {
      if (parte.tabla === 'negocio_configuracion') {
        const respuesta = await cliente
          .from(parte.tabla)
          .upsert(parte.filas, { onConflict: 'negocio_id' })
          .select('*')
          .single()
        if (respuesta.error) throw respuesta.error
        if (respuesta.data) {
          await db.preferencias.put(preferenciasDeLaNube(respuesta.data as Fila) as never)
        }
      } else if (parte.tabla === 'productos') {
        // El servidor es la autoridad para `actualizado_en`. Guardar esa
        // marca de vuelta en el aparato evita que el reloj adelantado de una
        // PC vieja haga parecer que los cambios de otro dispositivo son más
        // antiguos y los descarte.
        // La ficha (precio, costo, nombre) no transporta stock. Así una
        // edición de precio nunca puede pisar una venta de otro dispositivo.
        const filas = item.operacion === 'actualizar'
          ? parte.filas.map((fila) => {
              const ficha = { ...fila }
              delete ficha.stock
              delete ficha.eliminado_en
              return ficha
            })
          : parte.filas
        const respuesta = await cliente
          .from(parte.tabla)
          .upsert(filas)
          .select('*')
          .single()
        if (respuesta.error) throw respuesta.error
        if (respuesta.data) {
          const remoto = deLaNube('productos', respuesta.data as Fila) as Fila
          const id = remoto.id as string | undefined
          const local = id ? await db.productos.get(id) : undefined
          const versionLocal = (item.datos as Fila).actualizadoEn
          // No pises una edición que ocurrió mientras la petición estaba en
          // vuelo; quedó otra operación pendiente con esa versión.
          if (local && local.actualizadoEn === versionLocal) {
            await db.productos.put({
              ...local,
              ...remoto,
              categoria: local.categoria,
              favorito: local.favorito,
            } as never)
          }
        }
      } else if (CLAVE_DEL_PADRE[parte.tabla]) {
        // Renglones: se pisan por (cabecera, posición) y se borran los que
        // sobran si el pedido quedó con menos productos que antes.
        const clave = CLAVE_DEL_PADRE[parte.tabla]
        const { error } = await cliente.from(parte.tabla).upsert(parte.filas, { onConflict: `${clave},posicion` })
        if (error) throw error
        const padre = parte.filas[0]?.[clave]
        if (padre) {
          const sobrantes = await cliente.from(parte.tabla).delete().eq(clave, padre).gte('posicion', parte.filas.length)
          if (sobrantes.error) throw sobrantes.error
        }
      } else {
        const { error } = await cliente.from(parte.tabla).upsert(parte.filas)
        if (error) throw error
      }
    }
  }
}

const CLAVE_DEL_PADRE: Record<string, string> = {
  venta_items: 'venta_id',
  ingreso_items: 'ingreso_id',
  pedido_items: 'pedido_id',
}

export const DESTINO: Record<string, () => Table<unknown, unknown>> = {
  productos: () => db.productos as unknown as Table<unknown, unknown>,
  ventas: () => db.ventas as unknown as Table<unknown, unknown>,
  clientes: () => db.clientes as unknown as Table<unknown, unknown>,
  fiados: () => db.fiados as unknown as Table<unknown, unknown>,
  fiado_pagos: () => db.fiadoPagos as unknown as Table<unknown, unknown>,
  ingresos: () => db.ingresos as unknown as Table<unknown, unknown>,
  cierres: () => db.cierres as unknown as Table<unknown, unknown>,
  movimientos_caja: () => db.movimientosCaja as unknown as Table<unknown, unknown>,
  pedidos: () => db.pedidos as unknown as Table<unknown, unknown>,
  negocio_configuracion: () => db.preferencias as unknown as Table<unknown, unknown>,
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
      if (tabla === 'negocio_configuracion') {
        for (const fila of filas as Fila[]) {
          const local = await db.preferencias.get('unico')
          const marcaRemota = (fila.actualizadoEn as number | undefined) ?? 0
          if (local && local.actualizadoEn > marcaRemota) continue
          await destino().put({ ...fila, id: 'unico' })
          escritas++
        }
      } else if (tabla === 'productos') {
        for (const fila of filas as Fila[]) {
          const pendiente = await db.cola.get(`producto:${fila.id as string}`)
          const movimientosPendientes = (await db.cola.toArray()).some(
            (item) => item.entidad === 'movimientoStock' && (item.datos as { productoId?: string }).productoId === fila.id,
          )
          if (pendiente || movimientosPendientes) continue
          if (typeof fila.eliminadoEn === 'number') {
            await db.productos.delete(fila.id as string)
            await db.cola.delete(`producto:${fila.id as string}`)
            escritas++
            continue
          }
          const local = await db.productos.get(fila.id as string)
          if (local) {
            fila.categoria = local.categoria
            fila.favorito = local.favorito
          }
          await destino().put(fila)
          escritas++
        }
      } else {
        await destino().bulkPut(filas)
        escritas += filas.length
      }
    } catch {
      // se sigue con la próxima tabla: bajar algo es mejor que no bajar nada
    }
  }
  return escritas
}

/** Las ventas y los ingresos viven en la nube en dos tablas y la
 *  aplicación los usa juntas: los items se rearman con su cabecera. */
export function rearmarItems(
  tabla: 'ventas' | 'ingresos' | 'pedidos',
  cabeceras: Fila[],
  items: Fila[],
): unknown[] {
  const claveDelPadre = tabla === 'ventas' ? 'venta_id' : tabla === 'ingresos' ? 'ingreso_id' : 'pedido_id'
  return cabeceras.map((fila) => ({
    ...deLaNube(tabla, fila),
    items: items
      .filter((item) => item[claveDelPadre] === fila.id)
      .sort((a, b) => ((a.posicion as number | null) ?? 0) - ((b.posicion as number | null) ?? 0) || (a.id as number) - (b.id as number))
      .map((item) => {
        const local = deLaNube(`${tabla === 'ventas' ? 'venta' : tabla === 'ingresos' ? 'ingreso' : 'pedido'}_items`, item) as Fila
        delete local[tabla === 'ventas' ? 'ventaId' : tabla === 'ingresos' ? 'ingresoId' : 'pedidoId']
        delete local.id
        delete local.posicion
        return local
      }),
  }))
}

/** La bajada real contra Supabase. Las ventas se rearman con sus items,
 *  porque en la base viven en dos tablas y la aplicación las usa juntas:
 *  sin los items no habría forma de calcular la ganancia. */
export const traerDeSupabase: TraerFn = async (tabla) => {
  if (!cliente) throw new Error('nube apagada')
  const nube = cliente

  if (tabla === 'ventas' || tabla === 'ingresos' || tabla === 'pedidos') {
    const tablaItems = tabla === 'ventas' ? 'venta_items' : tabla === 'ingresos' ? 'ingreso_items' : 'pedido_items'
    // Paginado y con orden estable: sin orden, dos páginas pueden repetir
    // o saltear filas.
    const [cabeceras, items] = await Promise.all([
      todasLasFilas<Fila>((desde, hasta) => nube.from(tabla).select('*').order('id').range(desde, hasta)),
      todasLasFilas<Fila>((desde, hasta) => nube.from(tablaItems).select('*').order('id').range(desde, hasta)),
    ])
    return rearmarItems(tabla, cabeceras, items)
  }

  const filas = await todasLasFilas<Fila>((desde, hasta) =>
    tabla === 'negocio_configuracion'
      ? nube.from(tabla).select('*').range(desde, hasta)
      : nube.from(tabla).select('*').order('id').range(desde, hasta),
  )
  return tabla === 'negocio_configuracion'
    ? filas.map((fila) => preferenciasDeLaNube(fila))
    : filas.map((fila) => deLaNube(tabla, fila))
}

/** Items de muchas cabeceras: el `.in()` va en tandas para no armar una URL
 *  gigante, y cada tanda también se pagina. */
export async function itemsDe(tablaItems: string, claveDelPadre: string, ids: string[]): Promise<Fila[]> {
  if (!cliente) throw new Error('nube apagada')
  const nube = cliente
  const filas: Fila[] = []
  for (const tanda of enTandas(ids)) {
    filas.push(...await todasLasFilas<Fila>((desde, hasta) =>
      nube.from(tablaItems).select('*').in(claveDelPadre, tanda).order('id').range(desde, hasta)))
  }
  return filas
}
