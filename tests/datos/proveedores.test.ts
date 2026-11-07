import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'
import { comprasDelProveedor, mensajePedidoProveedor, pedidoSugerido } from '@/dominio/proveedores'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('proveedores', () => {
  it('se guardan, suben a la nube y se quitan sin borrarse', async () => {
    const proveedor = await repos.proveedores.guardar({ nombre: 'Distribuidora Norte', telefono: '261 555', visita: 'martes', nota: null, deuda: 500000 })
    expect(await repos.proveedores.todos()).toHaveLength(1)
    const [{ tabla, filas }] = aLaNube('proveedor', proveedor, 'n-1')
    expect(tabla).toBe('proveedores')
    expect(filas[0]).toMatchObject({ nombre: 'Distribuidora Norte', deuda: 500000, negocio_id: 'n-1' })
    await repos.proveedores.eliminar(proveedor.id)
    expect(await repos.proveedores.todos()).toHaveLength(0)
    expect(await db.cola.get(`proveedor:${proveedor.id}`)).toMatchObject({ operacion: 'eliminar' })
  })

  it('el producto guarda su proveedor (y viaja como proveedor_id); al quitarlo vuelve a null', async () => {
    const proveedor = await repos.proveedores.guardar({ nombre: 'Norte', telefono: null, visita: null, nota: null, deuda: 0 })
    const producto = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 1, precio: 2, stock: 1, stockMinimo: 5 })
    const asignado = await repos.productos.asignarProveedor(producto.id, proveedor.id)
    expect(aLaNube('producto', asignado, 'n-1')[0].filas[0]).toMatchObject({ proveedor_id: proveedor.id })
    expect(deLaNube('productos', { id: 'x', proveedor_id: proveedor.id })).toMatchObject({ proveedorId: proveedor.id })
    const quitado = await repos.productos.asignarProveedor(producto.id, null)
    expect(aLaNube('producto', quitado, 'n-1')[0].filas[0]).toMatchObject({ proveedor_id: null })
  })

  it('quitar un proveedor deja sus productos sin proveedor', async () => {
    const proveedor = await repos.proveedores.guardar({ nombre: 'Norte', telefono: null, visita: null, nota: null, deuda: 0 })
    const producto = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 1, precio: 2, stock: 1, stockMinimo: 5 })
    await repos.productos.asignarProveedor(producto.id, proveedor.id)
    await repos.proveedores.eliminar(proveedor.id)
    expect((await db.productos.get(producto.id))?.proveedorId).toBeUndefined()
  })

  it('arma el pedido con sus productos que se están acabando y el mensaje de WhatsApp', async () => {
    const proveedor = await repos.proveedores.guardar({ nombre: 'Distribuidora Norte', telefono: null, visita: null, nota: null, deuda: 0 })
    const falta = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 1, precio: 2, stock: 1, stockMinimo: 6 })
    const sobra = await repos.productos.guardar({ codigoBarras: null, nombre: 'Arroz', costo: 1, precio: 2, stock: 50, stockMinimo: 6 })
    await repos.productos.asignarProveedor(falta.id, proveedor.id)
    await repos.productos.asignarProveedor(sobra.id, proveedor.id)
    const pedido = pedidoSugerido(proveedor, await repos.productos.todos(), [], Date.now())
    expect(pedido.map((r) => r.producto.nombre)).toEqual(['Yerba'])
    expect(pedido[0].cantidad).toBe(5)
    expect(mensajePedidoProveedor('Almacén Rosales', proveedor, pedido)).toContain('• 5 × Yerba')
  })

  it('reconoce sus compras por el nombre escrito al cargar la factura', () => {
    const compras = comprasDelProveedor({ nombre: 'Distribuidora Norte' }, [
      { id: 'i1', fecha: 1, proveedor: 'distribuidora norte', items: [], origen: 'manual' },
      { id: 'i2', fecha: 2, proveedor: 'Otro', items: [], origen: 'manual' },
    ])
    expect(compras.map((c) => c.id)).toEqual(['i1'])
  })
})
