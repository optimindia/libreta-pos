import { describe, expect, it } from 'vitest'
import type { Cliente, Producto, Venta } from '@/dominio/tipos'
import {
  alertasProducto,
  compararPeriodos,
  clientesValiosos,
  estadoVencimiento,
  progresoObjetivo,
  productosDormidos,
  pronosticoVentas,
  rotacionStock,
  serieVentas,
} from '@/dominio/inteligencia'

const AHORA = new Date(2026, 7, 31, 12).getTime()
const producto: Producto = { id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3, actualizadoEn: AHORA }
const venta = (id: string, fecha: number, total = 420000, clienteId: string | null = null): Venta => ({ id, fecha, total, medioPago: 'efectivo', clienteId, items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: total, costo: 300000 }] })

describe('inteligencia comercial', () => {
  it('clasifica vencimientos y riesgo de crédito', async () => {
    expect(estadoVencimiento(new Date(2026, 7, 29).getTime(), AHORA)).toBe('vencido')
    expect(estadoVencimiento(new Date(2026, 8, 2).getTime(), AHORA)).toBe('vence-pronto')
    const modulo = await import('@/dominio/inteligencia')
    expect(modulo.riesgoFiado(100000, 100000, 1)).toBe('alto')
    expect(modulo.riesgoFiado(100000, undefined, 15)).toBe('medio')
  })

  it('detecta problemas de precio y stock', () => {
    expect(alertasProducto({ ...producto, precio: 200000, stock: 0 })).toEqual(['Vende debajo del costo', 'Sin stock'])
  })

  it('arma una serie diaria, compara períodos y proyecta', () => {
    const ventas = [venta('v1', AHORA, 420000), venta('v2', AHORA - 24 * 60 * 60 * 1000, 200000)]
    expect(serieVentas(ventas, 2, AHORA).map((punto) => punto.vendido)).toEqual([200000, 420000])
    expect(compararPeriodos(ventas, AHORA - 100, AHORA + 100, AHORA - 2 * 24 * 60 * 60 * 1000, AHORA - 24 * 60 * 60 * 1000).porcentaje).toBe(110)
    expect(pronosticoVentas(ventas, AHORA, 2, 7).proyectado).toBe(2170000)
  })

  it('calcula objetivo, cobertura, productos dormidos y clientes valiosos', () => {
    const ventas = [venta('v1', AHORA, 420000, 'c1')]
    expect(progresoObjetivo(750000, 1000000)).toMatchObject({ porcentaje: 75, restante: 250000, cumplido: false })
    expect(rotacionStock(producto, ventas, AHORA, 14).diasCobertura).toBe(140)
    expect(productosDormidos([producto, { ...producto, id: 'p2', nombre: 'Galletas' }], ventas, AHORA, 30).map((item) => item.id)).toEqual(['p2'])
    const clientes: Cliente[] = [{ id: 'c1', nombre: 'Marta', telefono: null }]
    expect(clientesValiosos(ventas, clientes)[0]).toMatchObject({ nombre: 'Marta', gastado: 420000, ventas: 1 })
  })
})
