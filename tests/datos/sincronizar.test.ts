import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar, pendientes } from '@/datos/local/cola'
import { sincronizar, bajarTodo } from '@/datos/nube/sincronizar'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('sincronizar', () => {
  it('sube lo pendiente y vacía la cola', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    const subir = vi.fn().mockResolvedValue(undefined)
    const resultado = await sincronizar(subir)
    expect(resultado.subidos).toBe(1)
    expect(await pendientes()).toHaveLength(0)
  })

  it('lo que falla queda en la cola para el próximo intento', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    const subir = vi.fn().mockRejectedValue(new Error('sin red'))
    const resultado = await sincronizar(subir)
    expect(resultado.fallidos).toBe(1)
    expect(await pendientes()).toHaveLength(1)
  })

  it('un fallo no frena la subida del resto', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v2' })
    const subir = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(undefined)
    const resultado = await sincronizar(subir)
    expect(resultado.subidos).toBe(1)
    expect(resultado.fallidos).toBe(1)
  })

  it('con la cola vacía no hace nada y no falla', async () => {
    const subir = vi.fn()
    expect(await sincronizar(subir)).toEqual({ subidos: 0, fallidos: 0, rechazados: 0 })
    expect(subir).not.toHaveBeenCalled()
  })

  it('subir dos veces la misma venta la sube una sola vez', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v1' })
    const subir = vi.fn().mockResolvedValue(undefined)
    await sincronizar(subir)
    expect(subir).toHaveBeenCalledTimes(1)
  })
})

const producto = {
  id: 'p1', codigoBarras: '779', nombre: 'Yerba',
  costo: 300000, precio: 420000, stock: 5, stockMinimo: 3, actualizadoEn: 0,
}

// Así llega de PostgREST un rechazo de RLS o de un trigger con errcode 42501.
const sinPermiso = { code: '42501', message: 'sólo el dueño puede ajustar o cargar stock', details: null, hint: null }

describe('rechazos de permiso (42501)', () => {
  it('no se reintentan: quedan apartados con el motivo y no frenan el resto', async () => {
    await encolar('movimientoCaja', 'crear', { id: 'm1' })
    await encolar('venta', 'crear', { id: 'v1' })
    const subir = vi.fn(async (item: { entidad: string }) => {
      if (item.entidad === 'movimientoCaja') throw sinPermiso
    })

    const resultado = await sincronizar(subir)

    expect(resultado).toEqual({ subidos: 1, fallidos: 0, rechazados: 1 })
    expect(await pendientes()).toHaveLength(0)
    const apartado = await db.cola.get('movimientoCaja:m1')
    expect(apartado?.rechazado).toBe(true)
    expect(apartado?.ultimoError).toMatch(/sin permiso/i)

    await sincronizar(subir)
    expect(subir).toHaveBeenCalledTimes(2)
  })

  it('un error de red común se sigue reintentando', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await sincronizar(vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const item = await db.cola.get('venta:v1')
    expect(item?.rechazado).toBeFalsy()
    expect(await pendientes()).toHaveLength(1)
  })

  it('un producto rechazado no le impide a la bajada traer la ficha real', async () => {
    await db.productos.put({ ...producto, precio: 1 })
    await encolar('producto', 'actualizar', { ...producto, precio: 1 })
    await sincronizar(vi.fn().mockRejectedValue(sinPermiso))

    await bajarTodo(async (tabla) => (tabla === 'productos' ? [{ ...producto }] : []))

    expect((await db.productos.get('p1'))?.precio).toBe(420000)
  })
})

describe('bajarTodo', () => {
  it('escribe en la base local lo que trae de la nube', async () => {
    const traer = vi.fn(async (tabla: string) => (tabla === 'productos' ? [producto] : []))
    const escritas = await bajarTodo(traer)
    expect(escritas).toBe(1)
    expect(await db.productos.count()).toBe(1)
  })

  it('no duplica lo que ya estaba: el mismo id se pisa', async () => {
    await db.productos.put(producto)
    const traer = vi.fn(async (tabla: string) => (tabla === 'productos' ? [producto] : []))
    await bajarTodo(traer)
    expect(await db.productos.count()).toBe(1)
  })

  it('con la nube vacía no escribe nada y no falla', async () => {
    expect(await bajarTodo(async () => [])).toBe(0)
  })

  it('si una tabla falla, las demás igual se bajan', async () => {
    const traer = vi.fn(async (tabla: string) => {
      if (tabla === 'ventas') throw new Error('sin red')
      return tabla === 'productos' ? [producto] : []
    })
    expect(await bajarTodo(traer)).toBe(1)
  })

  it('la bajada completa respeta un producto que todavía está pendiente de subir', async () => {
    await db.productos.put({ ...producto, stock: 8 })
    await encolar('producto', 'actualizar', { ...producto, stock: 8 })
    const traer = vi.fn(async (tabla: string) => (tabla === 'productos' ? [{ ...producto, stock: 2 }] : []))

    await bajarTodo(traer)

    expect((await db.productos.get('p1'))?.stock).toBe(8)
  })
})
