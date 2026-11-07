import { describe, it, expect } from 'vitest'
import { ahorroMayorista, aplicarMayorista, mapaMayorista } from '@/dominio/mayorista'
import { itemsParaCobrar } from '@/dominio/ventaAbierta'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'
import type { ItemVenta } from '@/dominio/tipos'

const item = (productoId: string, cantidad: number, precio: number): ItemVenta => ({ productoId, nombre: productoId, cantidad, precio, costo: 1 })
const mapa = mapaMayorista([
  { id: 'fideos', precioMayorista: 120000, mayoristaDesde: 12 },
  { id: 'aceite', precioMayorista: 400000 },
  { id: 'pan' },
])

describe('precio mayorista', () => {
  it('desde N unidades se aplica solo; sin cantidad, sólo en venta por mayor', () => {
    expect(aplicarMayorista([item('fideos', 12, 150000)], mapa)[0].precio).toBe(120000)
    expect(aplicarMayorista([item('fideos', 11, 150000)], mapa)[0].precio).toBe(150000)
    expect(aplicarMayorista([item('aceite', 2, 500000)], mapa)[0].precio).toBe(500000)
    expect(aplicarMayorista([item('aceite', 2, 500000)], mapa, true)[0].precio).toBe(400000)
    expect(ahorroMayorista([item('aceite', 2, 500000)], mapa, true)).toBe(200000)
  })

  it('nunca sube un precio de oferta más barato', () => {
    expect(aplicarMayorista([item('aceite', 1, 350000)], mapa, true)[0].precio).toBe(350000)
  })

  it('se cobra con el precio mayorista', () => {
    const cobrables = itemsParaCobrar({ items: [item('aceite', 1, 500000)], descuentoItems: {}, descuentoTotal: null, mayorista: true }, [], mapa)
    expect(cobrables[0].precio).toBe(400000)
  })

  it('viaja a la nube y vuelve', () => {
    const [parte] = aLaNube('producto', { id: 'x', nombre: 'X', precioMayorista: 120000, mayoristaDesde: 12 }, 'n-1')
    expect(parte.filas[0]).toMatchObject({ precio_mayorista: 120000, mayorista_desde: 12 })
    const [sin] = aLaNube('producto', { id: 'x', nombre: 'X' }, 'n-1')
    expect(sin.filas[0]).toMatchObject({ precio_mayorista: null, mayorista_desde: null })
    expect(deLaNube('productos', { id: 'x', precio_mayorista: 120000, mayorista_desde: '12' })).toMatchObject({ precioMayorista: 120000, mayoristaDesde: 12 })
  })
})
