import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorVentaInvalida, repos } from '@/datos/local/repos'
import { aLaNube } from '@/datos/nube/mapeo'

let productoId = ''
beforeEach(async () => {
  await db.delete()
  await db.open()
  productoId = (await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 800000, stock: 10, stockMinimo: 0 })).id
})
const items = () => [{ productoId, nombre: 'Yerba', cantidad: 1, precio: 800000, costo: 300000 }]

describe('registrar una venta con pago dividido', () => {
  it('guarda las partes, toma como medio el de la parte más grande y sube las partes a la nube', async () => {
    const venta = await repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null, pagos: [{ medio: 'efectivo', monto: 300000 }, { medio: 'transferencia', monto: 500000 }] })
    expect(venta.medioPago).toBe('transferencia')
    expect(venta.pagos).toHaveLength(2)
    const [cabecera] = aLaNube('venta', venta, 'n-1')
    expect(cabecera.filas[0]).toMatchObject({ pagos: [{ medio: 'efectivo', monto: 300000 }, { medio: 'transferencia', monto: 500000 }] })
  })

  it('a la libreta va sólo la parte fiada, y exige cliente', async () => {
    const pagos = [{ medio: 'efectivo' as const, monto: 500000 }, { medio: 'fiado' as const, monto: 300000 }]
    await expect(repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null, pagos })).rejects.toBeInstanceOf(ErrorVentaInvalida)
    const cliente = await repos.clientes.guardar({ nombre: 'Rosa', telefono: null })
    await repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: cliente.id, pagos })
    const fiados = await db.fiados.toArray()
    expect(fiados).toHaveLength(1)
    expect(fiados[0].monto).toBe(300000)
  })

  it('rechaza partes que no suman el total', async () => {
    await expect(repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null, pagos: [{ medio: 'efectivo', monto: 300000 }, { medio: 'qr', monto: 300000 }] })).rejects.toThrow(/suman/)
  })

  it('al anular, de la caja sale sólo lo que entró en efectivo', async () => {
    const venta = await repos.ventas.registrar({ items: items(), medioPago: 'efectivo', clienteId: null, pagos: [{ medio: 'efectivo', monto: 300000 }, { medio: 'transferencia', monto: 500000 }] })
    await repos.ventas.anular(venta.id, 'error')
    const [devolucion] = await db.movimientosCaja.toArray()
    expect(devolucion).toMatchObject({ tipo: 'salida', monto: 300000 })
  })
})
