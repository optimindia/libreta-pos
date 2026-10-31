import { describe, it, expect } from 'vitest'
import {
  cantidadValida, esFraccionado, formatearCantidad, importePorCantidad, leerCantidad, porMonto, porUnidad, redondearCantidad,
} from '@/dominio/cantidad'

describe('cantidades fraccionadas', () => {
  it('sabe si un producto se vende por kilo o litro', () => {
    expect(esFraccionado({})).toBe(false)
    expect(esFraccionado({ unidad: 'unidad' })).toBe(false)
    expect(esFraccionado({ unidad: 'kg' })).toBe(true)
    expect(esFraccionado({ unidad: 'l' })).toBe(true)
  })

  it('valida de a gramo o mililitro', () => {
    expect(cantidadValida(0.5)).toBe(true)
    expect(cantidadValida(1.234)).toBe(true)
    expect(cantidadValida(1.2345)).toBe(false)
    expect(cantidadValida(0)).toBe(false)
    expect(cantidadValida(-1)).toBe(false)
    expect(redondearCantidad(0.52631578)).toBe(0.526)
  })

  it('escribe la cantidad como la diría el almacenero', () => {
    expect(formatearCantidad(3)).toBe('3')
    expect(formatearCantidad(0.526, 'kg')).toBe('526 g')
    expect(formatearCantidad(1.25, 'kg')).toBe('1,25 kg')
    expect(formatearCantidad(0.5, 'l')).toBe('500 ml')
    expect(formatearCantidad(1.5, 'l')).toBe('1,5 L')
    expect(porUnidad('kg')).toBe('el kilo')
    expect(porUnidad('l')).toBe('el litro')
    expect(porUnidad()).toBe('c/u')
  })

  it('calcula el importe de una cantidad', () => {
    // medio litro de aceite a $3.800 el litro
    expect(importePorCantidad(380000, 0.5)).toBe(190000)
  })

  it('"dame $500 de pan" cobra exactamente $500 y dice cuánto pesar', () => {
    const resultado = porMonto(95000, 50000)!
    expect(resultado.cantidad).toBeCloseTo(0.526, 3)
    expect(importePorCantidad(resultado.precio, resultado.cantidad)).toBe(50000)
    // el precio por kilo se aparta apenas del de lista
    expect(Math.abs(resultado.precio - 95000)).toBeLessThan(100)
  })

  it('también es exacto con montos grandes', () => {
    for (const [precio, monto] of [[95000, 500000], [123456, 1000000], [380000, 250000], [99, 777700]]) {
      const resultado = porMonto(precio, monto)!
      expect(importePorCantidad(resultado.precio, resultado.cantidad)).toBe(monto)
    }
  })

  it('sin precio o sin plata no hay cantidad', () => {
    expect(porMonto(0, 50000)).toBeNull()
    expect(porMonto(95000, 0)).toBeNull()
  })

  it('lee lo que se escribe con coma o punto', () => {
    expect(leerCantidad('0,5')).toBe(0.5)
    expect(leerCantidad('1.25')).toBe(1.25)
    expect(leerCantidad('500')).toBe(500)
    expect(Number.isNaN(leerCantidad('abc'))).toBe(true)
    expect(Number.isNaN(leerCantidad(''))).toBe(true)
  })
})
