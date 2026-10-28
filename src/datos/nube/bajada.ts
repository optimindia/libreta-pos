import { db } from '@/datos/local/db'
import { cliente } from './cliente'
import { deLaNube, preferenciasDeLaNube, type Fila } from './mapeo'
import { DESTINO, itemsDe, rearmarItems } from './sincronizar'
import { todasLasFilas } from './paginar'

/** El solape reprocesa lo último bajado: el merge por id es idempotente
 *  y así las transacciones que llegan apenas antes del cursor no se pierden. */
const SOLAPE_MS = 30_000

async function productoTieneCambiosPendientes(id: string): Promise<boolean> {
  if (await db.cola.get(`producto:${id}`)) return true
  const cola = await db.cola.toArray()
  return cola.some((item) => item.entidad === 'movimientoStock' && (item.datos as { productoId?: string }).productoId === id)
}

export type TraerCambiosFn = (tabla: string, desdeISO: string) => Promise<unknown[]>

/** Trae de Supabase sólo lo cambiado desde la marca. El reloj es el del
 *  servidor: actualizado_en lo marcan la base y el trigger, nunca el cliente. */
export const traerCambiosDeSupabase: TraerCambiosFn = async (tabla, desdeISO) => {
  if (!cliente) throw new Error('nube apagada')
  const nube = cliente
  // Paginado y ordenado: un día con más de 1000 cambios no se corta a medias.
  // negocio_configuracion no tiene `id`: es una fila por negocio.
  const cambios = await todasLasFilas<Fila>((desde, hasta) => {
    const consulta = nube.from(tabla).select('*').gte('actualizado_en', desdeISO).order('actualizado_en')
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
    if (local && local.actualizadoEn > nueva) return false
    if (local) {
      // Son preferencias del aparato: la nube no las conoce, pero tampoco
      // debe borrarlas al bajar un precio o un stock.
      fila.categoria = local.categoria
      fila.favorito = local.favorito
    }
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

  for (const tabla of Object.keys(DESTINO)) {
    try {
      const filas = (await traer(tabla, desde)) as Fila[]
      for (const fila of filas) {
        const marca = (fila.actualizadoEn as number | undefined) ?? 0
        if (marca > maximo) maximo = marca
        if (await escribir(tabla, fila)) escritas++
      }
    } catch {
      fallo = true // se sigue con la próxima tabla: bajar algo es mejor que nada
    }
  }

  if (!fallo && maximo > cursor) {
    await db.negocio.update('unico', { ultimaBajada: maximo })
  }
  return escritas
}
