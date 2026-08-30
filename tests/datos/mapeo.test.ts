import { describe, it, expect } from 'vitest'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'
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
    const [{ filas }] = aLaNube('producto', producto, NEGOCIO)
    expect(filas[0].actualizado_en).toBe(new Date(1788000000000).toISOString())
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

  it('ida y vuelta devuelve el mismo producto', () => {
    const [{ filas }] = aLaNube('producto', producto, NEGOCIO)
    expect(deLaNube('productos', filas[0])).toEqual(producto)
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
