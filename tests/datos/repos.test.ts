import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import type { Producto } from '@/dominio/tipos'

const yerba: Omit<Producto, 'id' | 'actualizadoEn'> = {
  codigoBarras: '7791234567890', nombre: 'Yerba Playadito',
  costo: 300000, precio: 420000, stock: 12, stockMinimo: 3,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('repos.productos', () => {
  it('guarda un producto y le asigna id', async () => {
    const guardado = await repos.productos.guardar(yerba)
    expect(guardado.id).toBeTruthy()
    expect(await repos.productos.todos()).toHaveLength(1)
  })

  it('lo encuentra por código de barras', async () => {
    await repos.productos.guardar(yerba)
    const hallado = await repos.productos.porCodigoBarras('7791234567890')
    expect(hallado?.nombre).toBe('Yerba Playadito')
  })

  it('devuelve null si el código no existe', async () => {
    expect(await repos.productos.porCodigoBarras('000')).toBeNull()
  })

  it('busca por nombre sin distinguir mayúsculas ni acentos', async () => {
    await repos.productos.guardar(yerba)
    expect(await repos.productos.buscar('playadito')).toHaveLength(1)
    expect(await repos.productos.buscar('YERBA')).toHaveLength(1)
  })

  it('encuentra "Azúcar" buscando "azucar", sin el acento', async () => {
    await repos.productos.guardar({ ...yerba, codigoBarras: '999', nombre: 'Azúcar Ledesma' })
    expect(await repos.productos.buscar('azucar')).toHaveLength(1)
  })
})

describe('repos.ventas', () => {
  it('registra la venta y descuenta el stock del producto', async () => {
    const producto = await repos.productos.guardar(yerba)
    await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: 420000, costo: 300000 }],
    })
    const actualizado = await repos.productos.porCodigoBarras('7791234567890')
    expect(actualizado?.stock).toBe(10)
    expect(await repos.ventas.todas()).toHaveLength(1)
  })

  it('calcula el total de la venta desde los items', async () => {
    const producto = await repos.productos.guardar(yerba)
    const venta = await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: 420000, costo: 300000 }],
    })
    expect(venta.total).toBe(840000)
  })
})

describe('repos.fiados', () => {
  it('anota un fiado y lo lista como abierto', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: '2615551234' })
    await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
    expect(await repos.fiados.abiertos()).toHaveLength(1)
  })

  it('un fiado totalmente pagado deja de estar abierto', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    const fiado = await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
    await repos.fiados.pagar(fiado.id, 500000)
    expect(await repos.fiados.abiertos()).toHaveLength(0)
  })

  it('un pago parcial lo deja abierto con el saldo restante', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    const fiado = await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
    await repos.fiados.pagar(fiado.id, 200000)
    const abiertos = await repos.fiados.abiertos()
    expect(abiertos).toHaveLength(1)
    expect(abiertos[0].saldo).toBe(300000)
  })
})

describe('repos.ingresos', () => {
  it('registrar una compra suma el stock', async () => {
    const producto = await repos.productos.guardar({ ...yerba, stock: 0 })
    await repos.ingresos.registrar({
      proveedor: 'Mayorista', origen: 'manual',
      items: [{ productoId: producto.id, cantidad: 12, costoUnitario: 300000 }],
    })
    const actualizado = await repos.productos.porCodigoBarras('7791234567890')
    expect(actualizado?.stock).toBe(12)
  })

  it('la compra actualiza el costo del producto al último pagado', async () => {
    const producto = await repos.productos.guardar(yerba)
    await repos.ingresos.registrar({
      proveedor: null, origen: 'manual',
      items: [{ productoId: producto.id, cantidad: 6, costoUnitario: 350000 }],
    })
    const actualizado = await repos.productos.porCodigoBarras('7791234567890')
    expect(actualizado?.costo).toBe(350000)
  })
})
