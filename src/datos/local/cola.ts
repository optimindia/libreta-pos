import { db, type EnCola } from './db'

export const MAX_INTENTOS = 5

/** El id de la cola se deriva de la entidad y del id del dato: dos encolados
 *  del mismo hecho colapsan en uno, y un reintento nunca duplica la venta. */
function idDeCola(entidad: EnCola['entidad'], datos: unknown): string {
  const id = (datos as { id?: string }).id ?? crypto.randomUUID()
  return `${entidad}:${id}`
}

export async function encolar(
  entidad: EnCola['entidad'],
  operacion: EnCola['operacion'],
  datos: unknown,
): Promise<void> {
  await db.cola.put({
    id: idDeCola(entidad, datos),
    entidad,
    operacion,
    datos,
    intentos: 0,
    creadoEn: Date.now(),
  })
}

export async function pendientes(): Promise<EnCola[]> {
  const todas = await db.cola.orderBy('creadoEn').toArray()
  return todas.filter((item) => item.intentos < MAX_INTENTOS)
}

export async function marcarSubido(id: string): Promise<void> {
  await db.cola.delete(id)
}

export async function marcarFallido(id: string): Promise<void> {
  const item = await db.cola.get(id)
  if (!item) return
  await db.cola.update(id, { intentos: item.intentos + 1 })
}

export async function hayPendientes(): Promise<boolean> {
  return (await pendientes()).length > 0
}
