import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { sumarMontoLibre } from '@/dominio/varios'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('producto interno Varios', () => {
  it('se crea una sola vez y no aparece en el catálogo ni en la búsqueda', async () => {
    const primero = await repos.productos.varios()
    const segundo = await repos.productos.varios()
    expect(segundo.id).toBe(primero.id)
    expect(await db.productos.count()).toBe(1)
    expect(await repos.productos.todos()).toEqual([])
    expect(await repos.productos.buscar('Varios')).toEqual([])
  })

  it('una venta con monto libre se registra y no se queda sin stock', async () => {
    const varios = await repos.productos.varios()
    const items = sumarMontoLibre([], varios, 250000)
    const venta = await repos.ventas.registrar({ items, medioPago: 'efectivo', clienteId: null })
    expect(venta.total).toBe(250000)
    expect(venta.items[0]).toMatchObject({ nombre: 'Varios', precio: 250000, costo: 0 })
  })

  it('si el stock interno baja demasiado, se repone solo', async () => {
    const varios = await repos.productos.varios()
    await db.productos.put({ ...varios, stock: 5 })
    const repuesto = await repos.productos.varios()
    expect(repuesto.id).toBe(varios.id)
    expect(repuesto.stock).toBe(1_000_000)
  })
})
