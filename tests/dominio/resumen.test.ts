import { describe, it, expect } from 'vitest'
import { resumirVentas, ventasAArchivar } from '@/dominio/resumen'
import type { Venta } from '@/dominio/tipos'

const AHORA = new Date('2026-08-30T12:00:00').getTime()
const DIA = 24 * 60 * 60 * 1000

function venta(id: string, haceDias: number, cantidad = 1): Venta {
  return {
    id, fecha: AHORA - haceDias * DIA, total: 420000 * cantidad,
    medioPago: 'efectivo', clienteId: null,
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad, precio: 420000, costo: 300000 }],
  }
}

describe('resumirVentas', () => {
  it('junta en una fila las ventas del mismo día y producto', () => {
    const filas = resumirVentas([venta('v1', 400, 2), venta('v2', 400, 3)])
    expect(filas).toHaveLength(1)
    expect(filas[0].unidades).toBe(5)
    expect(filas[0].vendido).toBe(420000 * 5)
  })

  it('conserva la ganancia acumulada del día', () => {
    const filas = resumirVentas([venta('v1', 400, 2)])
    expect(filas[0].ganancia).toBe(240000)
  })

  it('separa días distintos', () => {
    expect(resumirVentas([venta('v1', 400), venta('v2', 401)])).toHaveLength(2)
  })

  it('usa la fecha en formato AAAA-MM-DD', () => {
    const filas = resumirVentas([venta('v1', 0)])
    expect(filas[0].dia).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sin ventas devuelve una lista vacía', () => {
    expect(resumirVentas([])).toEqual([])
  })
})

describe('ventasAArchivar', () => {
  it('selecciona sólo lo anterior a los doce meses', () => {
    const viejas = ventasAArchivar([venta('v1', 400), venta('v2', 30)], AHORA)
    expect(viejas.map((v) => v.id)).toEqual(['v1'])
  })

  it('no archiva nada si todo es reciente', () => {
    expect(ventasAArchivar([venta('v1', 10)], AHORA)).toHaveLength(0)
  })

  it('permite cambiar la ventana de gracia', () => {
    expect(ventasAArchivar([venta('v1', 100)], AHORA, 2)).toHaveLength(1)
  })
})
