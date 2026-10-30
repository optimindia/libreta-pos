import { describe, it, expect } from 'vitest'
import {
  ahorroTotal, conRenglones, importeDescuento, itemsParaCobrar, limpiarNombre, masVendidos,
  nombreDeVenta, repetirVenta, ventaConContenido, ventaNueva, LARGO_NOMBRE_VENTA,
} from '@/dominio/ventaAbierta'
import { totalTicket } from '@/dominio/ticket'
import type { ItemVenta, Producto, Venta } from '@/dominio/tipos'

const producto = (id: string, nombre: string, precio: number, stock = 10): Producto => ({
  id, codigoBarras: null, nombre, costo: 100, precio, stock, stockMinimo: 1, actualizadoEn: 0,
})
const item = (productoId: string, cantidad: number, precio: number): ItemVenta => ({
  productoId, nombre: productoId, cantidad, precio, costo: 100,
})
const venta = (fecha: number, items: ItemVenta[], estado: Venta['estado'] = 'completada'): Venta => ({
  id: `v${fecha}`, fecha, total: totalTicket(items), medioPago: 'efectivo', items, clienteId: null,
  estado, estadoCobro: 'confirmado',
})

describe('importeDescuento', () => {
  it('calcula porcentaje y pesos', () => {
    expect(importeDescuento(10000, { tipo: 'porcentaje', valor: 10 })).toBe(1000)
    expect(importeDescuento(10000, { tipo: 'pesos', valor: 2500 })).toBe(2500)
  })
  it('nunca deja la venta en cero: tope de un centavo', () => {
    expect(importeDescuento(10000, { tipo: 'pesos', valor: 99999 })).toBe(9999)
    expect(importeDescuento(10000, { tipo: 'porcentaje', valor: 100 })).toBe(9900)
  })
  it('ignora valores inválidos', () => {
    expect(importeDescuento(10000, { tipo: 'pesos', valor: -5 })).toBe(0)
    expect(importeDescuento(10000, { tipo: 'porcentaje', valor: Number.NaN })).toBe(0)
    expect(importeDescuento(1, { tipo: 'pesos', valor: 100 })).toBe(0)
  })
})

describe('itemsParaCobrar', () => {
  const base = { ...ventaNueva('a', 1), items: [item('p1', 2, 10000), item('p2', 1, 5000)] }

  it('sin descuentos deja los renglones como están', () => {
    expect(itemsParaCobrar(base)).toEqual(base.items)
  })

  it('el descuento de un renglón baja solo el precio de ese renglón', () => {
    const resultado = itemsParaCobrar({ ...base, descuentoItems: { p1: { tipo: 'porcentaje', valor: 10 } } })
    expect(resultado[0].precio).toBe(9000)
    expect(resultado[1].precio).toBe(5000)
    expect(totalTicket(resultado)).toBe(23000)
  })

  it('el descuento total en porcentaje da exactamente ese porcentaje', () => {
    const resultado = itemsParaCobrar({ ...base, descuentoTotal: { tipo: 'porcentaje', valor: 20 } })
    expect(totalTicket(resultado)).toBe(20000)
  })

  it('el descuento total en pesos se reparte entre los renglones', () => {
    const resultado = itemsParaCobrar({ ...base, descuentoTotal: { tipo: 'pesos', valor: 3000 } })
    expect(totalTicket(resultado)).toBe(22000)
    expect(resultado.every((renglon) => renglon.precio > 0)).toBe(true)
  })

  it('combina descuento de renglón y descuento total', () => {
    const resultado = itemsParaCobrar({
      ...base,
      descuentoItems: { p2: { tipo: 'pesos', valor: 1000 } },
      descuentoTotal: { tipo: 'porcentaje', valor: 10 },
    })
    // 20000 + 4000 = 24000 → −10% = 21600
    expect(totalTicket(resultado)).toBe(21600)
  })

  it('un descuento enorme nunca deja un precio en cero', () => {
    const resultado = itemsParaCobrar({ ...base, descuentoTotal: { tipo: 'pesos', valor: 10_000_000 } })
    expect(resultado.every((renglon) => renglon.precio >= 1)).toBe(true)
    expect(totalTicket(resultado)).toBeGreaterThan(0)
  })

  it('no muta los renglones originales (el precio de lista se conserva)', () => {
    itemsParaCobrar({ ...base, descuentoTotal: { tipo: 'porcentaje', valor: 50 } })
    expect(base.items[0].precio).toBe(10000)
  })

  it('ahorroTotal es la diferencia con el precio de lista', () => {
    expect(ahorroTotal({ ...base, descuentoTotal: { tipo: 'porcentaje', valor: 10 } })).toBe(2500)
    expect(ahorroTotal(base)).toBe(0)
  })
})

describe('conRenglones', () => {
  it('descarta el descuento de un renglón que ya no está', () => {
    const inicial = { ...ventaNueva('a', 1), items: [item('p1', 1, 100), item('p2', 1, 100)], descuentoItems: { p1: { tipo: 'pesos' as const, valor: 10 }, p2: { tipo: 'pesos' as const, valor: 10 } } }
    const nueva = conRenglones(inicial, [item('p2', 1, 100)], 5)
    expect(Object.keys(nueva.descuentoItems)).toEqual(['p2'])
    expect(nueva.actualizada).toBe(5)
  })
  it('al vaciar la venta se va también el descuento total', () => {
    const inicial = { ...ventaNueva('a', 1), items: [item('p1', 1, 100)], descuentoTotal: { tipo: 'pesos' as const, valor: 10 } }
    expect(conRenglones(inicial, []).descuentoTotal).toBeNull()
  })
})

describe('nombres y contenido', () => {
  it('sin nombre se llama "Venta N" según su lugar', () => {
    expect(nombreDeVenta(ventaNueva('a'), 0)).toBe('Venta 1')
    expect(nombreDeVenta({ ...ventaNueva('a'), nombre: '  Doña Rosa ' }, 2)).toBe('Doña Rosa')
  })
  it('limpia espacios repetidos y corta el largo', () => {
    expect(limpiarNombre('Doña   Rosa')).toBe('Doña Rosa')
    expect(limpiarNombre('x'.repeat(100))).toHaveLength(LARGO_NOMBRE_VENTA)
  })
  it('una venta vacía y sin nombre no tiene contenido; con nombre o renglones sí', () => {
    expect(ventaConContenido(ventaNueva('a'))).toBe(false)
    expect(ventaConContenido({ ...ventaNueva('a'), nombre: ' ' })).toBe(false)
    expect(ventaConContenido({ ...ventaNueva('a'), nombre: 'Rosa' })).toBe(true)
    expect(ventaConContenido({ ...ventaNueva('a'), items: [item('p1', 1, 1)] })).toBe(true)
  })
})

describe('masVendidos', () => {
  const productos = [producto('a', 'Arroz', 100), producto('b', 'Bebida', 100), producto('c', 'Café', 100, 0), producto('d', 'Dulce', 100)]
  it('ordena por unidades, ignora anuladas, viejas, sin stock y borradas', () => {
    const ventas = [
      venta(1000, [item('a', 1, 100), item('b', 5, 100), item('c', 9, 100), item('x', 9, 100)]),
      venta(2000, [item('a', 3, 100)]),
      venta(3000, [item('d', 50, 100)], 'anulada'),
      venta(10, [item('d', 50, 100)]),
    ]
    expect(masVendidos(ventas, productos, 500).map((p) => p.id)).toEqual(['b', 'a'])
  })
  it('respeta el límite', () => {
    const ventas = [venta(1000, [item('a', 1, 1), item('b', 1, 1), item('d', 1, 1)])]
    expect(masVendidos(ventas, productos, 0, 2)).toHaveLength(2)
  })
})

describe('repetirVenta', () => {
  const productos = [producto('a', 'Arroz', 500, 10), producto('b', 'Bebida', 800, 1), producto('c', 'Café', 900, 0)]
  it('usa el precio de hoy y recorta al stock disponible', () => {
    const anterior = venta(1, [item('a', 2, 400), item('b', 3, 700)])
    const { items, omitidos } = repetirVenta(anterior, productos, (p) => p.stock)
    expect(items.map((i) => [i.productoId, i.cantidad, i.precio])).toEqual([['a', 2, 500], ['b', 1, 800]])
    expect(omitidos).toEqual(['b (solo 1 de 3)'])
  })
  it('omite lo que no existe o no tiene stock', () => {
    const anterior = venta(1, [item('c', 1, 900), item('zzz', 1, 100)])
    const { items, omitidos } = repetirVenta(anterior, productos, (p) => p.stock)
    expect(items).toEqual([])
    expect(omitidos).toEqual(['c', 'zzz'])
  })
})
