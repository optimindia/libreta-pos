import { db } from '@/datos/local/db'
import type { Table } from 'dexie'
import { productoTieneCambiosPendientes } from '@/datos/local/cola'
import { cliente } from './cliente'
import { deLaNube, preferenciasDeLaNube, type Fila } from './mapeo'
import { DESTINO, SesionVencida, esErrorDeSesion, itemsDe, rearmarItems } from './sincronizar'
import { todasLasFilas } from './paginar'

/** El solape reprocesa lo último bajado: el merge por id es idempotente
 *  y así las transacciones que llegan apenas antes del cursor no se pierden. */
const SOLAPE_MS = 30_000

export type TraerCambiosFn = (tabla: string, desdeISO: string) => Promise<unknown[]>

/** Trae de Supabase sólo lo cambiado desde la marca. El reloj es el del
 *  servidor: actualizado_en lo marcan la base y el trigger, nunca el cliente. */
export const traerCambiosDeSupabase: TraerCambiosFn = async (tabla, desdeISO) => {
  if (!cliente) throw new Error('nube apagada')
  const nube = cliente
  // Paginado y ordenado: un día con más de 1000 cambios no se corta a medias.
  // negocio_configuracion no tiene `id`: es una fila por negocio.
  // De negocios sólo lo que se edita desde la app (lo demás es del panel).
  const cambios = await todasLasFilas<Fila>((desde, hasta) => {
    const base = nube.from(tabla)
    const consulta = (tabla === 'negocios' ? base.select('id,nombre,logo,color,actualizado_en') : base.select('*')).gte('actualizado_en', desdeISO).order('actualizado_en')
    return (tabla === 'negocio_configuracion' ? consulta : consulta.order('id')).range(desde, hasta)
  })

  if (tabla === 'ventas' || tabla === 'ingresos' || tabla === 'pedidos') {
    const tablaItems = tabla === 'ventas' ? 'venta_items' : tabla === 'ingresos' ? 'ingreso_items' : 'pedido_items'
    const claveDelPadre = tabla === 'ventas' ? 'venta_id' : tabla === 'ingresos' ? 'ingreso_id' : 'pedido_id'
    if (cambios.length === 0) return []
    const items = await itemsDe(tablaItems, claveDelPadre, cambios.map((fila) => fila.id as string))
    return rearmarItems(tabla, cambios, items)
  }

  return tabla === 'negocio_configuracion'
    ? cambios.map((fila) => preferenciasDeLaNube(fila))
    : cambios.map((fila) => deLaNube(tabla, fila))
}

/** El merge: en productos gana el más nuevo, para que una edición local
 *  todavía sin subir nunca la pise una bajada. El resto es append por id:
 *  si ya existía, es la misma fila. */
/** Dónde vive cada tabla en el aparato y con qué nombre se encola. */
const BORRABLES: Record<string, { local: () => Table<unknown, string>; cola: string }> = {
  clientes: { local: () => db.clientes as unknown as Table<unknown, string>, cola: 'cliente' },
  movimientos_caja: { local: () => db.movimientosCaja as unknown as Table<unknown, string>, cola: 'movimientoCaja' },
  ventas: { local: () => db.ventas as unknown as Table<unknown, string>, cola: 'venta' },
  fiados: { local: () => db.fiados as unknown as Table<unknown, string>, cola: 'fiado' },
  fiado_pagos: { local: () => db.fiadoPagos as unknown as Table<unknown, string>, cola: 'fiadoPago' },
  ingresos: { local: () => db.ingresos as unknown as Table<unknown, string>, cola: 'ingreso' },
  cierres: { local: () => db.cierres as unknown as Table<unknown, string>, cola: 'cierre' },
  pedidos: { local: () => db.pedidos as unknown as Table<unknown, string>, cola: 'pedido' },
  productos: { local: () => db.productos as unknown as Table<unknown, string>, cola: 'producto' },
}

/** Además de las tablas de datos: el nombre/logo/color del negocio y las
 *  marcas de lo que se borró en otro aparato. */
export const TABLAS_EXTRA = ['negocios', 'borrados'] as const

async function escribirExtra(tabla: string, fila: Fila): Promise<boolean> {
  if (tabla === 'negocios') {
    // Un cambio de este aparato que todavía no subió gana.
    const pendiente = (await db.cola.toArray()).some((item) => item.entidad === 'negocio' && !item.rechazado)
    if (pendiente) return false
    const actual = await db.negocio.get('unico')
    if (!actual || (actual.negocioId && actual.negocioId !== fila.id)) return false
    await db.negocio.update('unico', {
      nombre: typeof fila.nombre === 'string' ? fila.nombre : actual.nombre,
      logo: (fila.logo as string | null | undefined) ?? null,
      color: (fila.color as string | null | undefined) ?? null,
    })
    return true
  }
  // borrados: otro aparato borró la fila. También se descarta lo que este
  // aparato tenía pendiente de esa fila, o la volvería a crear en la nube.
  const destino = BORRABLES[fila.tabla as string]
  if (!destino) return false
  const id = fila.id as string
  await destino.local().delete(id)
  await db.cola.delete(`${destino.cola}:${id}`)
  return true
}

async function escribir(tabla: string, fila: Fila): Promise<boolean> {
  if (tabla === 'negocio_configuracion') {
    const local = await db.preferencias.get('unico')
    const nueva = fila.actualizadoEn as number
    if (local && local.actualizadoEn > nueva) return false
  }
  if (tabla === 'productos') {
    // No reemplazar una edición local o un movimiento que todavía no recibió
    // confirmación del servidor.
    if (await productoTieneCambiosPendientes(fila.id as string)) return false
    if (typeof fila.eliminadoEn === 'number') {
      await db.productos.delete(fila.id as string)
      // Una edición que quedó en cola en este dispositivo no debe revivir un
      // producto que otro dispositivo ya eliminó.
      await db.cola.delete(`producto:${fila.id as string}`)
      return true
    }
    const local = await db.productos.get(fila.id as string)
    const nueva = fila.actualizadoEn as number
    // Una edición local rechazada por permisos no es "más nueva": no subió.
    const rechazada = (await db.cola.get(`producto:${fila.id as string}`))?.rechazado === true
    if (local && local.actualizadoEn > nueva && !rechazada) return false
  }
  const destino = DESTINO[tabla]
  await destino().put(fila)
  return true
}

/** Baja lo que cambió en la nube desde la última vez. Devuelve las filas
 *  escritas. La marca del cursor sale de las mismas filas que bajan —
 *  nunca de una segunda vuelta de pedidos. Si alguna tabla falla, el
 *  cursor no avanza: la próxima vuelta repite desde la marca vieja,
 *  y el merge lo hace inofensivo. */
export async function bajarCambios(traer: TraerCambiosFn): Promise<number> {
  const negocio = await db.negocio.get('unico')
  if (!negocio) return 0

  const cursor = negocio.ultimaBajada ?? 0
  const desde = new Date(cursor - SOLAPE_MS).toISOString()

  let escritas = 0
  let maximo = cursor
  let fallo = false

  for (const tabla of [...Object.keys(DESTINO), ...TABLAS_EXTRA]) {
    try {
      const filas = (await traer(tabla, desde)) as Fila[]
      const extra = (TABLAS_EXTRA as readonly string[]).includes(tabla)
      for (const fila of filas) {
        const marca = (fila.actualizadoEn as number | undefined) ?? 0
        if (marca > maximo) maximo = marca
        if (await (extra ? escribirExtra(tabla, fila) : escribir(tabla, fila))) escritas++
      }
    } catch (error) {
      // Sin sesión válida ninguna tabla va a bajar: se corta y se renueva.
      if (esErrorDeSesion(error)) throw new SesionVencida()
      fallo = true // se sigue con la próxima tabla: bajar algo es mejor que nada
    }
  }

  if (!fallo && maximo > cursor) {
    await db.negocio.update('unico', { ultimaBajada: maximo })
  }
  return escritas
}
