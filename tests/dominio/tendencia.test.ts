import { describe, it, expect } from 'vitest'
import {
  barrasDeHoy, barrasDeLosMeses, barrasDeLosUltimosDias, barrasDePromedioPorDiaDeLaSemana,
  mejorBarra, mejorBarraDeVista, resumenDeBarras,
} from '@/dominio/tendencia'
import type { Venta } from '@/dominio/tipos'

// Miércoles 28 de octubre de 2026, al mediodía.
const AHORA = new Date(2026, 9, 28, 12)
const DIA = (diasAtras: number, hora = 10) => new Date(2026, 9, 28 - diasAtras, hora).getTime()

function venta(parcial: Partial<Venta>): Venta {
  return { id: 'v', fecha: DIA(0), total: 100, medioPago: 'efectivo', items: [], clienteId: null, ...parcial }
}

describe('últimos siete días', () => {
  it('siete barras, la de hoy al final, cada una con su plata', () => {
    const barras = barrasDeLosUltimosDias([venta({ fecha: DIA(0), total: 50000 }), venta({ fecha: DIA(6), total: 20000 }), venta({ fecha: DIA(7), total: 99900 })], AHORA)
    expect(barras).toHaveLength(7)
    expect(barras[6]).toMatchObject({ monto: 50000, cantidad: 1 })
    expect(barras[0]).toMatchObject({ monto: 20000, cantidad: 1 })
    expect(barras.reduce((s, b) => s + b.monto, 0)).toBe(70000)
  })

  it('las anuladas no cuentan', () => {
    const barras = barrasDeLosUltimosDias([venta({ fecha: DIA(0), total: 50000, estado: 'anulada' })], AHORA)
    expect(barras[6]).toMatchObject({ monto: 0, cantidad: 0, valor: 'Sin ventas' })
  })
})

describe('día de la semana', () => {
  it('promedia por día: lo vendido dividido por cuántos de ese día hubo en la ventana', () => {
    // Hace 21 días también fue miércoles: entran 4 miércoles (21, 14, 7 y hoy).
    const barras = barrasDePromedioPorDiaDeLaSemana([venta({ fecha: DIA(21), total: 30000 }), venta({ fecha: DIA(0), total: 10000 })], AHORA)
    expect(barras[2].titulo).toBe('Miércoles')
    expect(barras[2].monto).toBe(10000)
    expect(barras[0].monto).toBe(0)
  })

  it('en una cuenta nueva no divide por semanas que todavía no existen', () => {
    // Sólo hay ventas de hoy: el miércoles promedia sobre un día, no sobre ocho.
    const barras = barrasDePromedioPorDiaDeLaSemana([venta({ fecha: DIA(0), total: 80000 })], AHORA)
    expect(barras[2].monto).toBe(80000)
  })

  it('el mejor día se nombra y dice cuánto más que el promedio', () => {
    const barras = barrasDePromedioPorDiaDeLaSemana([venta({ fecha: DIA(0), total: 80000 }), venta({ fecha: DIA(1), total: 10000 })], AHORA)
    expect(mejorBarra(barras)).toBe(2)
    expect(resumenDeBarras('semana', barras)).toMatch(/^Tu mejor día es el miércoles: \$800 por día, un \d+% más que el promedio de la semana$/)
  })
})

describe('por mes', () => {
  it('doce meses, el actual al final, con el mes anterior en su lugar', () => {
    const barras = barrasDeLosMeses([venta({ fecha: DIA(0), total: 100000 }), venta({ fecha: new Date(2026, 8, 5).getTime(), total: 30000 })], AHORA)
    expect(barras).toHaveLength(12)
    expect(barras[11]).toMatchObject({ rotulo: 'Oct', titulo: 'Octubre 2026', monto: 100000 })
    expect(barras[10]).toMatchObject({ rotulo: 'Sep', monto: 30000 })
    expect(barras[0].rotulo).toBe('Nov')
  })

  it('la frase de abajo dice el mejor mes cerrado y cómo viene el último frente al anterior', () => {
    const barras = barrasDeLosMeses([
      venta({ fecha: new Date(2026, 7, 5).getTime(), total: 300000 }),
      venta({ fecha: new Date(2026, 8, 5).getTime(), total: 150000 }),
    ], AHORA)
    expect(resumenDeBarras('meses', barras)).toBe('Mejor mes: Agosto 2026 ($3.000) · Septiembre va 50% abajo de Agosto')
  })

  it('el mes en curso no cuenta como mejor mes, aunque vaya arriba', () => {
    const barras = barrasDeLosMeses([
      venta({ fecha: new Date(2026, 7, 5).getTime(), total: 300000 }),
      venta({ fecha: DIA(0), total: 900000 }),
    ], AHORA)
    expect(mejorBarraDeVista('meses', barras)).toBe(9)
    expect(resumenDeBarras('meses', barras)).toMatch(/^Mejor mes: Agosto 2026/)
  })
})

describe('hoy por horario', () => {
  it('mantiene el mismo detalle de antes: horario, plata y cantidad', () => {
    const barras = barrasDeHoy([venta({ fecha: new Date(2026, 9, 28, 9).getTime(), total: 420000 })], AHORA)
    expect(barras[1]).toMatchObject({ titulo: '8 a 10 h', valor: '$4.200', detalle: '1 venta' })
    expect(barras[1].lectura).toBe('8 a 10 h · $4.200 · 1 venta')
    expect(resumenDeBarras('hoy', barras)).toBe('Tu mejor horario: 8 a 10 h')
  })
})
