import { describe, it, expect } from 'vitest'
import { aplicarPromos, promoValida, type Promo } from '@/dominio/promos'
import { ahorroTotal, itemsParaCobrar } from '@/dominio/ventaAbierta'
import { normalizarAjustes } from '@/datos/local/repos'
import type { ItemVenta } from '@/dominio/tipos'

const item = (productoId: string, cantidad: number, precio: number): ItemVenta => ({ productoId, nombre: productoId, cantidad, precio, costo: 1 })
const tresPorDos: Promo = { id: 'a', nombre: '3x2 Coca', activa: true, tipo: 'nxm', productoId: 'coca', lleva: 3, paga: 2 }
const porCantidad: Promo = { id: 'b', nombre: 'Fideos x6', activa: true, tipo: 'cantidad', productoId: 'fideos', desde: 6, porcentaje: 10 }
const combo: Promo = { id: 'c', nombre: 'Mate', activa: true, tipo: 'combo', partes: [{ productoId: 'yerba', cantidad: 1 }, { productoId: 'azucar', cantidad: 1 }], precio: 500000 }

describe('promociones', () => {
  it('3x2: cada grupo de 3 regala una unidad, el resto paga entero', () => {
    const r = aplicarPromos([item('coca', 4, 300000)], [tresPorDos])
    expect(r.porItem.coca).toBe(300000)
    expect(r.aplicadas[0]).toMatchObject({ veces: 1, ahorro: 300000 })
    expect(aplicarPromos([item('coca', 2, 300000)], [tresPorDos]).aplicadas).toHaveLength(0)
  })

  it('por cantidad: desde N unidades descuenta el porcentaje de todo el renglón', () => {
    expect(aplicarPromos([item('fideos', 6, 150000)], [porCantidad]).porItem.fideos).toBe(90000)
    expect(aplicarPromos([item('fideos', 5, 150000)], [porCantidad]).aplicadas).toHaveLength(0)
  })

  it('combo: reparte el ahorro entre los productos y cuenta cuántas veces entra', () => {
    const r = aplicarPromos([item('yerba', 2, 450000), item('azucar', 1, 150000)], [combo])
    expect(r.aplicadas[0]).toMatchObject({ veces: 1, ahorro: 100000 })
    expect((r.porItem.yerba ?? 0) + (r.porItem.azucar ?? 0)).toBe(100000)
  })

  it('las pausadas o mal armadas no se aplican', () => {
    expect(aplicarPromos([item('coca', 3, 300000)], [{ ...tresPorDos, activa: false }]).aplicadas).toHaveLength(0)
    expect(promoValida({ ...tresPorDos, paga: 3 })).toBe(false)
    expect(promoValida({ ...combo, partes: [{ productoId: 'yerba', cantidad: 1 }] })).toBe(false)
    expect(normalizarAjustes({ promos: [tresPorDos, { tipo: 'raro' }] }).promos).toHaveLength(1)
  })

  it('al cobrar el 3x2 de $3.000 sale $6.000 por las tres, en pesos redondos', () => {
    const venta = { items: [item('coca', 3, 300000)], descuentoItems: {}, descuentoTotal: null }
    const cobrables = itemsParaCobrar(venta, [tresPorDos])
    expect(cobrables[0].precio * 3).toBe(600000)
    expect(ahorroTotal(venta, [tresPorDos])).toBe(300000)
  })

  it('un 3x2 de $1.000 redondea a favor del cliente, sin centavos', () => {
    const venta = { items: [item('pan', 3, 100000)], descuentoItems: {}, descuentoTotal: null }
    const precio = itemsParaCobrar(venta, [{ ...tresPorDos, productoId: 'pan' }])[0].precio
    expect(precio % 100).toBe(0)
    expect(precio * 3).toBeLessThanOrEqual(200000)
  })
})
