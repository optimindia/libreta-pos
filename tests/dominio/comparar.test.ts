import { describe, it, expect } from 'vitest'
import { fechaLarga, compararConLaSemanaPasada, textoDuracion } from '@/dominio/comparar'
import type { Venta } from '@/dominio/tipos'

const SABADO = new Date('2026-08-29T12:00:00')
const DIA = 24 * 60 * 60 * 1000

function venta(fecha: number, total: number): Venta {
  return {
    id: String(fecha) + total, fecha, total, medioPago: 'efectivo', clienteId: null,
    items: [{ productoId: 'p1', nombre: 'x', cantidad: 1, precio: total, costo: 0 }],
  }
}

describe('fechaLarga', () => {
  it('escribe la fecha con los espacios en su lugar', () => {
    expect(fechaLarga(new Date('2026-08-30T12:00:00'))).toBe('domingo, 30 de agosto')
  })

  it('usa los nombres en español', () => {
    expect(fechaLarga(new Date('2026-01-05T12:00:00'))).toBe('lunes, 5 de enero')
  })
})

describe('compararConLaSemanaPasada', () => {
  it('calcula cuánto más se vendió que el mismo día de la semana pasada', () => {
    const ventas = [
      venta(SABADO.getTime(), 110000),
      venta(SABADO.getTime() - 7 * DIA, 100000),
    ]
    expect(compararConLaSemanaPasada(ventas, SABADO)).toBe(10)
  })

  it('devuelve negativo cuando se vendió menos', () => {
    const ventas = [
      venta(SABADO.getTime(), 50000),
      venta(SABADO.getTime() - 7 * DIA, 100000),
    ]
    expect(compararConLaSemanaPasada(ventas, SABADO)).toBe(-50)
  })

  it('devuelve null si la semana pasada no hubo ventas: no hay con qué comparar', () => {
    expect(compararConLaSemanaPasada([venta(SABADO.getTime(), 50000)], SABADO)).toBeNull()
  })
})

describe('textoDuracion', () => {
  it('avisa cuando ya no queda stock, en vez de decir "0 días"', () => {
    expect(textoDuracion(0)).toBe('ya no te queda')
  })

  it('usa el singular con un día', () => {
    expect(textoDuracion(1)).toBe('te dura 1 día')
  })

  it('usa el plural con varios días', () => {
    expect(textoDuracion(5)).toBe('te dura 5 días')
  })

  it('sin datos de venta lo dice así', () => {
    expect(textoDuracion(null)).toBe('está por debajo del mínimo')
  })
})
