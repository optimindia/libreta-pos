import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { faltantes, controlaStock } from '@/dominio/stock'
import { alertasProducto } from '@/dominio/inteligencia'
import { valorStock } from '@/dominio/reportes'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const base = { codigoBarras: null, costo: 500000, precio: 790000, stock: 0, stockMinimo: 3 }

describe('productos sin control de stock', () => {
  it('se venden con stock en 0, no se descuentan ni generan movimientos', async () => {
    const aceite = await repos.productos.guardar({ ...base, nombre: 'Super 20W-50 suelto', unidad: 'l', sinControlStock: true })
    const venta = await repos.ventas.registrar({ items: [{ productoId: aceite.id, nombre: aceite.nombre, cantidad: 4, precio: 790000, costo: 500000 }], medioPago: 'efectivo', clienteId: null })
    expect(venta.total).toBe(3160000)
    expect((await db.productos.get(aceite.id))?.stock).toBe(0)
    const cola = await db.cola.toArray()
    expect(cola.some((item) => item.entidad === 'movimientoStock')).toBe(false)
    await repos.ventas.anular(venta.id, 'prueba')
    expect((await db.productos.get(aceite.id))?.stock).toBe(0)
  })

  it('con control, sigue frenando la venta sin stock', async () => {
    const filtro = await repos.productos.guardar({ ...base, nombre: 'Filtro' })
    await expect(repos.ventas.registrar({ items: [{ productoId: filtro.id, nombre: 'Filtro', cantidad: 1, precio: 790000, costo: 500000 }], medioPago: 'efectivo', clienteId: null })).rejects.toThrow()
  })

  it('no avisa faltantes ni suma al valor del inventario', async () => {
    const libre = { id: 'a', nombre: 'A', ...base, sinControlStock: true, actualizadoEn: 0 }
    expect(controlaStock(libre)).toBe(false)
    expect(faltantes([libre])).toEqual([])
    expect(alertasProducto(libre)).toEqual([])
    expect(valorStock([{ ...libre, stock: 10 }]).costo).toBe(0)
  })

  it('se prende y apaga en tanda y viaja a la nube', async () => {
    const a = await repos.productos.guardar({ ...base, nombre: 'A' })
    const b = await repos.productos.guardar({ ...base, nombre: 'B' })
    expect(await repos.productos.cambiarControlStock([a.id, b.id], false)).toBe(2)
    expect((await db.productos.get(a.id))?.sinControlStock).toBe(true)
    const [parte] = aLaNube('producto', (await db.productos.get(a.id))!, 'n-1')
    expect(parte.filas[0].sin_control_stock).toBe(true)
    expect(deLaNube('productos', { id: 'x', sin_control_stock: true }).sinControlStock).toBe(true)
  })
})
