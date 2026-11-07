import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'

let yerba = ''
let aceite = ''
beforeEach(async () => {
  await db.delete()
  await db.open()
  yerba = (await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 400000, stock: 10, stockMinimo: 0 })).id
  aceite = (await repos.productos.guardar({ codigoBarras: null, nombre: 'Aceite', costo: 150000, precio: 200000, stock: 10, stockMinimo: 0 })).id
})
const items = () => [
  { productoId: yerba, nombre: 'Yerba', cantidad: 2, precio: 400000, costo: 300000 },
  { productoId: aceite, nombre: 'Aceite', cantidad: 1, precio: 200000, costo: 150000 },
]

describe('repos.ventas.devolver', () => {
  it('devuelve al stock, achica la venta y, con la caja abierta, no suma un gasto', async () => {
    const venta = await repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null })
    await repos.ventas.devolver(venta.id, [{ productoId: yerba, cantidad: 1 }], 'roto')
    expect((await db.productos.get(yerba))?.stock).toBe(9)
    expect((await db.ventas.get(venta.id))?.total).toBe(600000)
    expect(await db.movimientosCaja.count()).toBe(0)
    const movimientos = (await db.cola.toArray()).filter((i) => i.entidad === 'movimientoStock' && (i.datos as { origen: string }).origen === 'anulacion')
    expect(movimientos).toHaveLength(1)
  })

  it('si la venta es de una caja ya cerrada, el efectivo devuelto sale de la caja de hoy', async () => {
    const venta = await repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null })
    await repos.cierres.registrar({ fondoInicial: 0, ventasEfectivo: 1000000, pagosFiadoEfectivo: 0, esperado: 1000000, contado: 1000000 })
    await repos.ventas.devolver(venta.id, [{ productoId: aceite, cantidad: 1 }])
    const [salida] = await db.movimientosCaja.toArray()
    expect(salida).toMatchObject({ tipo: 'salida', monto: 200000 })
  })

  it('en un fiado baja la deuda', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Rosa', telefono: null })
    const venta = await repos.ventas.registrar({ items: items(), medioPago: 'fiado', clienteId: cliente.id })
    await repos.ventas.devolver(venta.id, [{ productoId: yerba, cantidad: 1 }])
    const [fiado] = await db.fiados.toArray()
    expect(fiado.monto).toBe(600000)
  })
})
