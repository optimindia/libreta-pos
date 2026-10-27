import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar } from '@/datos/local/cola'
import { bajarCambios, type TraerCambiosFn } from '@/datos/nube/bajada'

const ahora = Date.now()

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('bajarCambios', () => {
  // OJO con estos tests: el `desde` se captura en una variable y se
  // afirma DESPUÉS de la llamada. Un expect adentro del mock que fallara
  // se convertiría en un rechazo de promesa... y bajarCambios se lo
  // traga en su catch: el test pasaría sin haber verificado nada.
  it('baja lo nuevo y avanza el cursor a la marca del servidor', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null })
    const visto: string[] = []
    const traer = (async (tabla: string, desde: string) => {
      visto.push(desde)
      if (tabla !== 'productos') return []
      return [
        { id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
          stock: 5, stockMinimo: 2, actualizadoEn: ahora },
      ]
    }) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    expect(await db.productos.count()).toBe(1)
    expect(visto[0]).toBe(new Date(0 - 30_000).toISOString())
    const negocio = await db.negocio.get('unico')
    expect(negocio?.ultimaBajada).toBe(ahora)
  })

  it('pide sólo desde el cursor menos el solape en la segunda vuelta', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 1000 })
    const visto: string[] = []
    const traer = (async (_tabla: string, desde: string) => {
      visto.push(desde)
      return []
    }) as unknown as TraerCambiosFn
    await bajarCambios(traer)
    expect(visto[0]).toBe(new Date(1000 - 30_000).toISOString())
  })

  it('no pisa un producto con edición local más nueva que la fila que baja', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba editada', costo: 300, precio: 420,
      stock: 9, stockMinimo: 2, actualizadoEn: ahora,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'productos'
        ? [{
            id: 'p1', codigoBarras: null, nombre: 'Yerba vieja de la nube', costo: 300, precio: 420,
            stock: 1, stockMinimo: 2, actualizadoEn: ahora - 60_000,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const local = await db.productos.get('p1')
    expect(local?.nombre).toBe('Yerba editada')
    expect(local?.stock).toBe(9)
  })

  it('pisa el producto local cuando la fila que baja es más nueva', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba vieja', costo: 300, precio: 420,
      stock: 1, stockMinimo: 2, actualizadoEn: ahora - 60_000,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'productos'
        ? [{
            id: 'p1', codigoBarras: null, nombre: 'Yerba nueva', costo: 300, precio: 500,
            stock: 7, stockMinimo: 2, actualizadoEn: ahora,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const local = await db.productos.get('p1')
    expect(local?.nombre).toBe('Yerba nueva')
    expect(local?.stock).toBe(7)
  })

  it('no pisa un producto mientras este aparato tiene un movimiento de stock pendiente', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
      stock: 4, stockMinimo: 2, actualizadoEn: ahora,
    })
    await encolar('movimientoStock', 'crear', { id: 'm1', productoId: 'p1', cantidad: -1, origen: 'venta' })
    const traer = vi.fn(async (tabla: string) => tabla === 'productos'
      ? [{ id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 500, stock: 5, stockMinimo: 2, actualizadoEn: ahora + 1 }]
      : []) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(0)
    expect(await db.productos.get('p1')).toMatchObject({ stock: 4, precio: 420 })
  })

  it('retira de este dispositivo un producto dado de baja en otro', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
      stock: 5, stockMinimo: 2, actualizadoEn: ahora - 60_000,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'productos'
        ? [{ id: 'p1', eliminadoEn: ahora, actualizadoEn: ahora }]
        : [],
    ) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    expect(await db.productos.get('p1')).toBeUndefined()
  })

  it('baja las funciones del negocio y conserva su id estable', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'negocio_configuracion'
        ? [{ id: 'unico', negocioId: 'nube-1', funciones: { pedidos: false }, actualizadoEn: ahora }]
        : [],
    ) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    expect(await db.preferencias.get('unico')).toMatchObject({
      negocioId: 'nube-1', funciones: { pedidos: false }, actualizadoEn: ahora,
    })
  })

  it('no pisa una preferencia local más nueva con una bajada vieja', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.preferencias.put({
      id: 'unico', negocioId: 'nube-1', funciones: { pedidos: false } as never, actualizadoEn: ahora,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'negocio_configuracion'
        ? [{ id: 'unico', negocioId: 'nube-1', funciones: { pedidos: true }, actualizadoEn: ahora - 60_000 }]
        : [],
    ) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(0)
    expect((await db.preferencias.get('unico'))?.funciones.pedidos).toBe(false)
  })

  it('la venta baja con sus items rearmados', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'ventas'
        ? [{
            id: 'v1', fecha: ahora, total: 840, medioPago: 'efectivo', clienteId: null,
            items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 420, costo: 300 }],
            actualizadoEn: ahora,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const venta = await db.ventas.get('v1')
    expect(venta?.items).toHaveLength(1)
    expect(venta?.total).toBe(840)
  })

  it('si una tabla falla, las demás bajan igual y el cursor no avanza', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 500 })
    const traer = (async (tabla: string) => {
      if (tabla === 'ventas') throw new Error('sin red')
      if (tabla !== 'productos') return []
      return [{
        id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
        stock: 5, stockMinimo: 2, actualizadoEn: ahora,
      }]
    }) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    const negocio = await db.negocio.get('unico')
    expect(negocio?.ultimaBajada).toBe(500)
  })

  it('sin fila de negocio local no hace nada', async () => {
    const traer = vi.fn() as unknown as TraerCambiosFn
    expect(await bajarCambios(traer)).toBe(0)
    expect(traer).not.toHaveBeenCalled()
  })
})
