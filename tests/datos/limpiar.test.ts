import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { db } from '@/datos/local/db'
import { limpiarDatosLocales } from '@/datos/local/limpiar'

describe('limpiarDatosLocales', () => {
  it('vacía todas las tablas de IndexedDB, incluida la cola de subida', async () => {
    await db.open()
    await db.cola.put({ id: 'c', entidad: 'venta', operacion: 'crear', datos: {}, intentos: 0, creadoEn: 1 })
    await db.productos.put({ id: 'p', nombre: 'x' } as never)
    await db.negocio.put({ id: 'unico', nombre: 'n', logo: null, color: null })
    await limpiarDatosLocales()
    for (const tabla of db.tables) expect(await tabla.count(), tabla.name).toBe(0)
  })
})
