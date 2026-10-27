import { describe, it, expect } from 'vitest'
import { aLaNube, deLaNube, preferenciasDeLaNube } from '@/datos/nube/mapeo'
import type { Producto, Venta } from '@/dominio/tipos'

const NEGOCIO = '11111111-1111-4111-8111-111111111111'

const producto: Producto = {
  id: 'p1', codigoBarras: '779', nombre: 'Yerba',
  costo: 300000, precio: 420000, stock: 5, stockMinimo: 3, actualizadoEn: 1788000000000,
}

const venta: Venta = {
  id: 'v1', fecha: 1788000000000, total: 420000, medioPago: 'efectivo', clienteId: null,
  items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }],
}

describe('aLaNube', () => {
  it('traduce los nombres de campo al formato de la base', () => {
    const [{ tabla, filas }] = aLaNube('producto', producto, NEGOCIO)
    expect(tabla).toBe('productos')
    expect(filas[0]).toMatchObject({
      id: 'p1', codigo_barras: '779', nombre: 'Yerba', stock_minimo: 3,
    })
  })

  it('agrega el negocio a cada fila: sin eso RLS la rechaza', () => {
    const [{ filas }] = aLaNube('producto', producto, NEGOCIO)
    expect(filas[0].negocio_id).toBe(NEGOCIO)
  })

  it('manda las fechas como texto ISO, no como número', () => {
    const [{ filas }] = aLaNube('venta', venta, NEGOCIO)
    expect(filas[0].fecha).toBe(new Date(1788000000000).toISOString())
  })

  it('parte la venta en la venta y sus items, que son dos tablas', () => {
    const partes = aLaNube('venta', venta, NEGOCIO)
    expect(partes.map((parte) => parte.tabla)).toEqual(['ventas', 'venta_items'])
    expect(partes[1].filas[0]).toMatchObject({
      venta_id: 'v1', producto_id: 'p1', cantidad: 1, precio: 420000, negocio_id: NEGOCIO,
    })
  })

  it('una venta sin items no genera fila de items vacía', () => {
    const partes = aLaNube('venta', { ...venta, items: [] }, NEGOCIO)
    expect(partes).toHaveLength(1)
  })

  it('la subida no manda actualizado_en: la marca la pone la base', () => {
    const producto = {
      id: 'p1', codigoBarras: null, nombre: 'Yerba',
      costo: 300000, precio: 420000, stock: 5, stockMinimo: 2,
      actualizadoEn: 123456789,
    }
    const partes = aLaNube('producto', producto, 'neg-1')
    expect(partes[0].filas[0]).not.toHaveProperty('actualizado_en')
  })

  it('manda null cuando una edición quita una oferta existente', () => {
    const partes = aLaNube('producto', {
      ...producto,
      precioOferta: undefined,
      ofertaHasta: undefined,
    }, NEGOCIO)
    expect(partes[0].filas[0]).toMatchObject({ precio_oferta: null, oferta_hasta: null })
  })
})

describe('deLaNube', () => {
  it('vuelve a la forma que usa la aplicación', () => {
    const local = deLaNube('productos', {
      id: 'p1', negocio_id: NEGOCIO, codigo_barras: '779', nombre: 'Yerba',
      costo: 300000, precio: 420000, stock: 5, stock_minimo: 3,
      actualizado_en: '2026-08-30T12:00:00.000Z',
    })
    expect(local).toMatchObject({ id: 'p1', codigoBarras: '779', stockMinimo: 3 })
    expect(typeof (local as { actualizadoEn: number }).actualizadoEn).toBe('number')
  })

  it('no arrastra el negocio_id adentro de la aplicación', () => {
    const local = deLaNube('productos', { id: 'p1', negocio_id: NEGOCIO, nombre: 'x' })
    expect(local).not.toHaveProperty('negocio_id')
  })

  it('ida y vuelta devuelve el mismo producto (sin la marca, que es de la base)', () => {
    const [{ filas }] = aLaNube('producto', producto, NEGOCIO)
    const esperado: Partial<typeof producto> = { ...producto }
    delete esperado.actualizadoEn
    expect(deLaNube('productos', filas[0])).toEqual(esperado)
  })
})

describe('mapeo de cierres', () => {
  const cierre = {
    id: 'c1', fecha: 1788000000000,
    fondoInicial: 50000, ventasEfectivo: 420000, pagosFiadoEfectivo: 30000,
    esperado: 500000, contado: 498000,
  }

  it('va a la tabla cierres con los nombres de la base', () => {
    const [{ tabla, filas }] = aLaNube('cierre', cierre, NEGOCIO)
    expect(tabla).toBe('cierres')
    expect(filas[0]).toMatchObject({
      id: 'c1', fondo_inicial: 50000, ventas_efectivo: 420000,
      pagos_fiado_efectivo: 30000, esperado: 500000, contado: 498000,
    })
    expect(typeof filas[0].fecha).toBe('string')
  })

  it('ida y vuelta devuelve el mismo cierre', () => {
    const [{ filas }] = aLaNube('cierre', cierre, NEGOCIO)
    expect(deLaNube('cierres', filas[0])).toEqual(cierre)
  })
})

describe('mapeo de movimientos de caja', () => {
  const movimiento = {
    id: 'm1', fecha: 1788000000000, tipo: 'salida', concepto: 'Proveedor', monto: 250000, medioPago: 'efectivo',
  }

  it('lo envía a la tabla sincronizada y conserva sus campos', () => {
    const [{ tabla, filas }] = aLaNube('movimientoCaja', movimiento, NEGOCIO)
    expect(tabla).toBe('movimientos_caja')
    expect(filas[0]).toMatchObject({ id: 'm1', tipo: 'salida', concepto: 'Proveedor', monto: 250000, medio_pago: 'efectivo', negocio_id: NEGOCIO })
    expect(deLaNube('movimientos_caja', filas[0])).toEqual(movimiento)
  })
})

describe('mapeo de preferencias del negocio', () => {
  it('sube la configuración a una fila única sin permitir un id inventado', () => {
    const [{ tabla, filas }] = aLaNube('preferencias', {
      id: 'unico', negocioId: NEGOCIO,
      funciones: { vender: true, pedidos: false }, actualizadoEn: 1788000000000,
    }, NEGOCIO)
    expect(tabla).toBe('negocio_configuracion')
    expect(filas[0]).toMatchObject({ negocio_id: NEGOCIO, funciones: { vender: true, pedidos: false } })
    expect(filas[0]).not.toHaveProperty('id')
    expect(filas[0].actualizado_en).toBe(new Date(1788000000000).toISOString())
  })

  it('vuelve a una preferencia local con id estable y marca numérica', () => {
    const local = preferenciasDeLaNube({
      negocio_id: NEGOCIO,
      funciones: { vender: true, pedidos: false },
      actualizado_en: '2026-08-30T12:00:00.000Z',
    })
    expect(local).toMatchObject({ id: 'unico', negocioId: NEGOCIO, funciones: { pedidos: false } })
    expect(typeof local.actualizadoEn).toBe('number')
  })
})
