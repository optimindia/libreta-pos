import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { ErrorClienteConHistorial, ErrorProductoConHistorial, ErrorStockInsuficiente, repos } from '@/datos/local/repos'
import { pendientes } from '@/datos/local/cola'
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

  it('no permite ajustar el stock por debajo de cero', async () => {
    const producto = await repos.productos.guardar({ ...yerba, stock: 2 })

    await expect(repos.productos.ajustarStock(producto.id, -3)).rejects.toMatchObject({
      name: 'ErrorStockInsuficiente',
      disponible: 2,
    })
    expect((await db.productos.get(producto.id))?.stock).toBe(2)
  })

  it('elimina un producto sin historial y encola la baja sincronizable', async () => {
    const producto = await repos.productos.guardar(yerba)
    await db.cola.clear() // simula que su alta ya fue confirmada en la nube

    await expect(repos.productos.eliminar(producto.id)).resolves.toBe(true)

    expect(await db.productos.get(producto.id)).toBeUndefined()
    expect(await pendientes()).toEqual([
      expect.objectContaining({
        entidad: 'producto', operacion: 'eliminar', datos: { id: producto.id, eliminadoEn: expect.any(Number) },
      }),
    ])
  })

  it('conserva un producto que ya tiene historial de ventas', async () => {
    const producto = await repos.productos.guardar({ ...yerba, stock: 2 })
    await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: producto.precio, costo: producto.costo }],
    })

    await expect(repos.productos.eliminar(producto.id)).rejects.toMatchObject({
      name: 'ErrorProductoConHistorial',
      ventas: 1,
      ingresos: 0,
      pedidos: 0,
    })
    await expect(repos.productos.eliminar(producto.id)).rejects.toBeInstanceOf(ErrorProductoConHistorial)
    expect(await db.productos.get(producto.id)).toBeDefined()
  })
})

describe('repos.productos: código de barras repetido (FUN-13)', () => {
  const base = { costo: 100, precio: 200, stock: 0, stockMinimo: 0 }

  it('no deja guardar otro producto con un código que ya existe', async () => {
    await repos.productos.guardar({ ...base, codigoBarras: '779001', nombre: 'Yerba' })
    await expect(repos.productos.guardar({ ...base, codigoBarras: ' 779001 ', nombre: 'Otra yerba' }))
      .rejects.toThrow(/código/i)
    expect(await repos.productos.todos()).toHaveLength(1)
  })

  it('editar un producto con su propio código sigue funcionando', async () => {
    const yerba = await repos.productos.guardar({ ...base, codigoBarras: '779001', nombre: 'Yerba' })
    await repos.productos.guardar({ ...yerba, precio: 300 })
    expect((await repos.productos.todos())[0].precio).toBe(300)
  })

  it('varios productos sin código no chocan entre sí', async () => {
    await repos.productos.guardar({ ...base, codigoBarras: null, nombre: 'Pan' })
    await repos.productos.guardar({ ...base, codigoBarras: null, nombre: 'Facturas' })
    expect(await repos.productos.todos()).toHaveLength(2)
  })

  it('un código vacío se trata como sin código y no se encuentra al escanear vacío', async () => {
    await repos.productos.guardar({ ...base, codigoBarras: '' as unknown as null, nombre: 'Pan' })
    await repos.productos.guardar({ ...base, codigoBarras: '  ' as unknown as null, nombre: 'Facturas' })
    expect(await repos.productos.porCodigoBarras('')).toBeNull()
    expect((await repos.productos.todos()).map((p) => p.codigoBarras)).toEqual([null, null])
  })
})

describe('repos.ingresos: costo 0 (FUN-13)', () => {
  it('un ingreso con costo 0 suma el stock y no pisa el costo conocido', async () => {
    const p = await repos.productos.guardar({ codigoBarras: null, nombre: 'Gaseosa', costo: 70000, precio: 100000, stock: 1, stockMinimo: 0 })
    await repos.ingresos.registrar({ proveedor: null, origen: 'manual', items: [{ productoId: p.id, cantidad: 5, costoUnitario: 0 }] })
    const [actual] = await repos.productos.todos()
    expect(actual.stock).toBe(6)
    expect(actual.costo).toBe(70000)
  })

  it('un ingreso con costo 0 de un producto sin costo conocido lo deja en 0 sin romper', async () => {
    const p = await repos.productos.guardar({ codigoBarras: null, nombre: 'Muestra', costo: 0, precio: 100000, stock: 0, stockMinimo: 0 })
    await repos.ingresos.registrar({ proveedor: null, origen: 'manual', items: [{ productoId: p.id, cantidad: 2, costoUnitario: 0 }] })
    expect((await repos.productos.todos())[0].stock).toBe(2)
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

  it('rechaza una venta que supera el stock y no registra movimientos parciales', async () => {
    const producto = await repos.productos.guardar({ ...yerba, stock: 1 })
    await expect(repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: producto.precio, costo: producto.costo }],
    })).rejects.toBeInstanceOf(ErrorStockInsuficiente)
    expect((await repos.productos.porCodigoBarras('7791234567890'))?.stock).toBe(1)
    expect(await repos.ventas.todas()).toHaveLength(0)
  })

  it('una venta encola un movimiento de stock atómico', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000,
      stock: 5, stockMinimo: 2,
    })
    const producto = (await repos.productos.todos())[0]

    await repos.ventas.registrar({
      items: [{ productoId: producto.id, nombre: 'Yerba', cantidad: 2, precio: 420000, costo: 300000 }],
      medioPago: 'efectivo',
      clienteId: null,
    })

    const cola = await pendientes()
    const movimiento = cola.find((item) => item.entidad === 'movimientoStock')
    expect(movimiento).toMatchObject({
      operacion: 'crear',
      datos: { productoId: producto.id, cantidad: -2, origen: 'venta' },
    })

    const guardado = await db.productos.get(producto.id)
    expect(guardado!.stock).toBe(3)
  })

  it('calcula el total de la venta desde los items', async () => {
    const producto = await repos.productos.guardar(yerba)
    const venta = await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 2, precio: 420000, costo: 300000 }],
    })
    expect(venta.total).toBe(840000)
  })

  it('una venta fiada crea la deuda del cliente', async () => {
    const producto = await repos.productos.guardar(yerba)
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })

    const venta = await repos.ventas.registrar({
      medioPago: 'fiado', clienteId: cliente.id,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: 420000, costo: 300000 }],
    })

    const fiados = await repos.fiados.abiertos()
    expect(fiados).toHaveLength(1)
    expect(fiados[0]).toMatchObject({ clienteId: cliente.id, ventaId: venta.id, monto: 420000 })
  })

  it('anular una venta devuelve stock, conserva auditoría y registra devolución en efectivo', async () => {
    const producto = await repos.productos.guardar({ ...yerba, stock: 2 })
    const venta = await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: producto.precio, costo: producto.costo }],
    })

    const anulada = await repos.ventas.anular(venta.id, 'Producto equivocado')

    expect(anulada.estado).toBe('anulada')
    expect(anulada.motivoAnulacion).toBe('Producto equivocado')
    expect((await db.productos.get(producto.id))?.stock).toBe(2)
    expect(await db.movimientosCaja.toArray()).toMatchObject([{ tipo: 'salida', monto: venta.total, medioPago: 'efectivo' }])
  })

  it('no permite anular un fiado que ya recibió un pago', async () => {
    const producto = await repos.productos.guardar(yerba)
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    const venta = await repos.ventas.registrar({
      medioPago: 'fiado', clienteId: cliente.id,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: producto.precio, costo: producto.costo }],
    })
    const fiado = (await db.fiados.toArray())[0]
    await repos.fiados.pagar(fiado.id, 1000)

    await expect(repos.ventas.anular(venta.id, 'Devolución')).rejects.toMatchObject({ name: 'ErrorVentaNoAnulable' })
    expect((await db.ventas.get(venta.id))?.estado).not.toBe('anulada')
    expect((await db.productos.get(producto.id))?.stock).toBe(11)
  })
})

describe('repos.clientes', () => {
  it('elimina un cliente sin historial y encola el borrado', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Cliente temporal', telefono: null })

    await expect(repos.clientes.eliminar(cliente.id)).resolves.toBe(true)

    expect(await db.clientes.get(cliente.id)).toBeUndefined()
    const cola = await pendientes()
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ entidad: 'cliente', operacion: 'eliminar', datos: { id: cliente.id } })
  })

  it('conserva un cliente que tiene historial de fiado', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })

    await expect(repos.clientes.eliminar(cliente.id)).rejects.toBeInstanceOf(ErrorClienteConHistorial)
    expect(await db.clientes.get(cliente.id)).toBeDefined()
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

  it('un ingreso encola un movimiento de stock atómico', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000,
      stock: 2, stockMinimo: 2,
    })
    const producto = (await repos.productos.todos())[0]

    await repos.ingresos.registrar({
      proveedor: 'Mayorista',
      origen: 'manual',
      items: [{ productoId: producto.id, cantidad: 10, costoUnitario: 300000 }],
    })

    const cola = await pendientes()
    const movimiento = cola.find((item) => item.entidad === 'movimientoStock')
    expect(movimiento).toMatchObject({
      operacion: 'crear',
      datos: { productoId: producto.id, cantidad: 10, origen: 'ingreso' },
    })

    const guardado = await db.productos.get(producto.id)
    expect(guardado!.stock).toBe(12)
  })
})

describe('repos.negocio', () => {
  it('guardar los ajustes del negocio no borra el vínculo con la nube', async () => {
    await db.negocio.put({
      id: 'unico', nombre: 'Viejo', logo: null, color: null,
      negocioId: 'nube-1', telefono: '542615551234', ultimaBajada: 1234,
    })

    await repos.negocio.guardarAjustes('Nuevo nombre', 'data:logo', '#12694E')

    const negocio = await db.negocio.get('unico')
    expect(negocio?.nombre).toBe('Nuevo nombre')
    expect(negocio?.logo).toBe('data:logo')
    expect(negocio?.color).toBe('#12694E')
    expect(negocio?.negocioId).toBe('nube-1')
    expect(negocio?.telefono).toBe('542615551234')
    expect(negocio?.ultimaBajada).toBe(1234)
  })
})

describe('repos.preferencias', () => {
  it('devuelve todas las funciones activas aunque todavía no haya configuración guardada', async () => {
    const preferencias = await repos.preferencias.obtener()
    expect(preferencias.id).toBe('unico')
    expect(preferencias.funciones.vender).toBe(true)
    expect(preferencias.funciones.configuracion).toBe(true)
    expect(preferencias.actualizadoEn).toBe(0)
  })

  it('guarda una preferencia opcional y la encola cuando el negocio está vinculado', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'nube-1' })
    const guardadas = await repos.preferencias.guardarFunciones({ escanerVenta: false, pedidos: false })
    expect(guardadas.funciones.escanerVenta).toBe(false)
    expect(guardadas.funciones.pedidos).toBe(false)
    expect(await db.preferencias.get('unico')).toMatchObject({ negocioId: 'nube-1', funciones: { escanerVenta: false, pedidos: false } })
    expect(await pendientes()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entidad: 'preferencias', operacion: 'actualizar' }),
    ]))
  })

  it('nunca desactiva las funciones necesarias para operar', async () => {
    const guardadas = await repos.preferencias.guardarFunciones({ vender: false, cuenta: false, configuracion: false })
    expect(guardadas.funciones.vender).toBe(true)
    expect(guardadas.funciones.cuenta).toBe(true)
    expect(guardadas.funciones.configuracion).toBe(true)
  })
})

describe('repos.cierres', () => {
  it('guarda un cierre y queda en la cola para subir', async () => {
    await repos.cierres.registrar({
      fondoInicial: 0, ventasEfectivo: 420000, pagosFiadoEfectivo: 0,
      esperado: 420000, contado: 420000,
    })
    expect(await repos.cierres.todos()).toHaveLength(1)
    const encolados = await db.cola.toArray()
    expect(encolados.filter((item) => item.entidad === 'cierre')).toHaveLength(1)
  })

  it('el último cierre es el más reciente, no el primero', async () => {
    await repos.cierres.registrar({
      fondoInicial: 0, ventasEfectivo: 100000, pagosFiadoEfectivo: 0,
      esperado: 100000, contado: 100000,
    })
    const segundo = await repos.cierres.registrar({
      fondoInicial: 100000, ventasEfectivo: 200000, pagosFiadoEfectivo: 0,
      esperado: 300000, contado: 298000,
    })
    expect((await repos.cierres.ultimo())?.id).toBe(segundo.id)
  })

  it('sin cierres el último es null', async () => {
    expect(await repos.cierres.ultimo()).toBeNull()
  })
})
