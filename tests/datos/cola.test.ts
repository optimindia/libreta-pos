import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar, pendientes, marcarSubido, marcarFallido, hayPendientes, MAX_INTENTOS } from '@/datos/local/cola'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('cola de sincronización', () => {
  it('encola una operación pendiente', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    expect(await pendientes()).toHaveLength(1)
  })

  it('conserva el orden en que ocurrieron las cosas', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v2' })
    const lista = await pendientes()
    expect((lista[0].datos as { id: string }).id).toBe('v1')
  })

  it('marcar como subido la saca de la cola', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    const [item] = await pendientes()
    await marcarSubido(item.id)
    expect(await pendientes()).toHaveLength(0)
  })

  it('un fallo la deja en la cola y cuenta el intento', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    const [item] = await pendientes()
    await marcarFallido(item.id)
    const [reintentar] = await pendientes()
    expect(reintentar.intentos).toBe(1)
  })

  it('tras demasiados intentos deja de reintentar, pero no borra el dato', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    for (let i = 0; i < MAX_INTENTOS; i++) {
      const [item] = await db.cola.toArray()
      await marcarFallido(item.id)
    }
    expect(await pendientes()).toHaveLength(0)
    expect(await db.cola.count()).toBe(1)
  })

  it('hayPendientes refleja el estado de la cola', async () => {
    expect(await hayPendientes()).toBe(false)
    await encolar('venta', 'crear', { id: 'v1' })
    expect(await hayPendientes()).toBe(true)
  })

  it('reencolar la misma entidad no la duplica: se sube una sola vez', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v1' })
    expect(await pendientes()).toHaveLength(1)
  })
})
