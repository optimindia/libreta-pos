import { db, type EnCola } from './db'
import { nuevoId } from '@/dominio/id'

export const MAX_INTENTOS = 5
/** Aviso local para que la cola se suba apenas cambia un dato. Mantiene el
 *  modo offline: encolar sigue siendo la operación principal y el aviso sólo
 *  despierta al sincronizador cuando hay una sesión y conexión. */
export const EVENTO_DATOS_PENDIENTES = 'libreta:datos-pendientes'

/** El id de la cola se deriva de la entidad y del id del dato: dos encolados
 *  del mismo hecho colapsan en uno, y un reintento nunca duplica la venta. */
function idDeCola(entidad: EnCola['entidad'], datos: unknown): string {
  const id = (datos as { id?: string }).id ?? nuevoId()
  return `${entidad}:${id}`
}

export async function encolar(
  entidad: EnCola['entidad'],
  operacion: EnCola['operacion'],
  datos: unknown,
): Promise<void> {
  const id = idDeCola(entidad, datos)
  const anterior = await db.cola.get(id)
  // Un producto nuevo todavía no existe en la nube. Si se edita antes de
  // subirlo, conserva "crear" y su stock inicial; los cambios de stock
  // posteriores se transmiten como movimientos independientes.
  if (entidad === 'producto' && anterior?.operacion === 'crear' && operacion === 'eliminar') {
    await db.cola.delete(id)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_DATOS_PENDIENTES))
    return
  }
  const esCreacionPendiente = entidad === 'producto' && anterior?.operacion === 'crear'
  const datosFinales = esCreacionPendiente
    ? { ...(datos as Record<string, unknown>), stock: (anterior.datos as Record<string, unknown>).stock }
    : datos
  await db.cola.put({
    id,
    entidad,
    operacion: esCreacionPendiente ? 'crear' : operacion,
    datos: datosFinales,
    intentos: 0,
    creadoEn: Date.now(),
  })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_DATOS_PENDIENTES))
}

export async function pendientes(): Promise<EnCola[]> {
  const todas = await db.cola.orderBy('creadoEn').toArray()
  return todas.filter((item) => item.intentos < MAX_INTENTOS)
}

export async function marcarSubido(id: string, creadoEn?: number, datos?: unknown): Promise<void> {
  const actual = await db.cola.get(id)
  // Si el usuario volvió a editar el mismo registro mientras se subía la
  // versión anterior, no borres la nueva operación que reemplazó a ésta.
  if (!actual || (creadoEn !== undefined && actual.creadoEn !== creadoEn)) return
  if (datos !== undefined && JSON.stringify(actual.datos) !== JSON.stringify(datos)) return
  await db.cola.delete(id)
}

export async function marcarFallido(id: string, error?: unknown): Promise<void> {
  const item = await db.cola.get(id)
  if (!item) return
  const detalle = error instanceof Error ? error.message : 'No se pudo conectar con la nube.'
  await db.cola.update(id, {
    intentos: item.intentos + 1,
    ultimoError: detalle.slice(0, 220),
    ultimoIntentoEn: Date.now(),
  })
}

/** La base dijo que no por permisos (42501): reintentar no lo va a cambiar.
 *  Se aparta con el motivo, como una operación agotada, para no golpear la
 *  nube en cada vuelta ni trabar al resto de la cola. Queda guardada por si
 *  el dueño cambia el rol y alguien la reintenta a mano. */
export async function marcarRechazado(id: string, error?: unknown): Promise<void> {
  const item = await db.cola.get(id)
  if (!item) return
  const motivo = (error as { message?: unknown } | undefined)?.message
  await db.cola.update(id, {
    intentos: MAX_INTENTOS,
    rechazado: true,
    ultimoError: `Sin permiso: ${typeof motivo === 'string' && motivo ? motivo : 'la nube rechazó la operación'}`.slice(0, 220),
    ultimoIntentoEn: Date.now(),
  })
}

export async function hayPendientes(): Promise<boolean> {
  return (await pendientes()).length > 0
}

/** Todo lo que todavía no está en la nube, incluido lo agotado o rechazado.
 *  Es lo que se perdería al borrar la copia del aparato. */
export async function haySinSubir(): Promise<boolean> {
  return (await db.cola.count()) > 0
}

/** Permite reactivar manualmente operaciones que agotaron sus reintentos. */
export async function reintentarTodos(): Promise<number> {
  const agotados = (await db.cola.toArray()).filter((item) => item.intentos > 0)
  if (agotados.length === 0) return 0
  await db.transaction('rw', db.cola, async () => {
    for (const item of agotados) await db.cola.update(item.id, { intentos: 0, ultimoError: undefined, ultimoIntentoEn: undefined, rechazado: undefined })
  })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_DATOS_PENDIENTES))
  return agotados.length
}
