import { describe, it, expect } from 'vitest'
import {
  alturasDeBarras, detalleFranjas, fiadosVencidos, listaCorta, mejorFranja, porDebajoDelCosto, porReponer, saludo, ventasPorFranja,
} from '@/dominio/inicio'
import type { Fiado, FiadoPago, Producto, Venta } from '@/dominio/tipos'

const HOY = new Date('2026-10-27T12:00:00')
const A_LAS = (hora: number, minuto = 0) => new Date(2026, 9, 27, hora, minuto).getTime()

function venta(parcial: Partial<Venta>): Venta {
  return { id: 'v', fecha: A_LAS(10), total: 100000, medioPago: 'efectivo', items: [], clienteId: null, ...parcial }
}

describe('saludo', () => {
  it.each([
    [5, 'Buen día'], [11, 'Buen día'], [12, 'Buenas tardes'], [19, 'Buenas tardes'],
    [20, 'Buenas noches'], [0, 'Buenas noches'], [4, 'Buenas noches'],
  ])('a las %s dice "%s"', (hora, esperado) => {
    expect(saludo(hora)).toBe(esperado)
  })
})

describe('ventasPorFranja', () => {
  it('reparte lo vendido hoy en franjas de dos horas desde las 6', () => {
    const ventas = [venta({ fecha: A_LAS(6, 30), total: 100 }), venta({ fecha: A_LAS(9), total: 250 }), venta({ fecha: A_LAS(9, 59), total: 50 })]
    // 6:30 cae en 6–8; 9:00 y 9:59 caen en 8–10
    expect(ventasPorFranja(ventas, HOY)).toEqual([100, 300, 0, 0, 0, 0, 0, 0])
  })

  it('lo de antes de abrir y después de cerrar suma a la primera y a la última franja', () => {
    const ventas = [venta({ fecha: A_LAS(3), total: 10 }), venta({ fecha: A_LAS(23), total: 20 })]
    const franjas = ventasPorFranja(ventas, HOY)
    expect(franjas[0]).toBe(10)
    expect(franjas[7]).toBe(20)
  })

  it('ignora las ventas anuladas y las de otro día', () => {
    const ventas = [
      venta({ total: 500, estado: 'anulada' }),
      venta({ total: 700, fecha: new Date(2026, 9, 26, 10).getTime() }),
      venta({ total: 90 }),
    ]
    expect(ventasPorFranja(ventas, HOY).reduce((a, b) => a + b, 0)).toBe(90)
  })

  it('sin ventas todas las franjas valen cero', () => {
    expect(ventasPorFranja([], HOY)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('alturasDeBarras', () => {
  it('la mejor franja llena el gráfico y el resto va en proporción', () => {
    expect(alturasDeBarras([0, 50, 100])).toEqual([12, 50, 100])
  })

  it('un día sin ventas deja barras bajas e iguales', () => {
    expect(alturasDeBarras([0, 0, 0])).toEqual([12, 12, 12])
  })

  it('una barra chica nunca baja del mínimo visible', () => {
    expect(alturasDeBarras([1, 1000])[0]).toBe(12)
  })
})

describe('mejorFranja', () => {
  it('devuelve la posición de la franja con más ventas', () => {
    expect(mejorFranja([10, 90, 40])).toBe(1)
  })

  it('devuelve null si todavía no se vendió nada', () => {
    expect(mejorFranja([0, 0, 0])).toBeNull()
  })
})

describe('fiadosVencidos', () => {
  const dia = 24 * 60 * 60 * 1000
  const ahora = A_LAS(12)
  const fiado = (id: string, monto: number, vence: number | null): Fiado => ({
    id, clienteId: 'c', ventaId: null, monto, fecha: ahora - 20 * dia, vence,
  })

  it('cuenta los que pasaron su fecha y siguen con saldo', () => {
    const fiados = [fiado('a', 1000, ahora - 3 * dia), fiado('b', 2500, ahora - dia)]
    expect(fiadosVencidos(fiados, [], ahora)).toEqual({ cantidad: 2, monto: 3500 })
  })

  it('un pago parcial baja el monto y uno total lo saca de la cuenta', () => {
    const fiados = [fiado('a', 1000, ahora - 3 * dia), fiado('b', 2500, ahora - dia)]
    const pagos: FiadoPago[] = [
      { id: 'p1', fiadoId: 'a', monto: 400, fecha: ahora },
      { id: 'p2', fiadoId: 'b', monto: 2500, fecha: ahora },
    ]
    expect(fiadosVencidos(fiados, pagos, ahora)).toEqual({ cantidad: 1, monto: 600 })
  })

  it('un fiado sin fecha o que todavía no venció no es vencido', () => {
    const fiados = [fiado('a', 1000, null), fiado('b', 1000, ahora + 5 * dia)]
    expect(fiadosVencidos(fiados, [], ahora)).toEqual({ cantidad: 0, monto: 0 })
  })
})

describe('porReponer y listaCorta', () => {
  const producto = (nombre: string, stock: number, stockMinimo: number): Producto => ({
    id: nombre, codigoBarras: null, nombre, costo: 1, precio: 2, stock, stockMinimo, actualizadoEn: 1,
  })

  it('cuenta los que llegaron a su mínimo y nombra los más urgentes', () => {
    const productos = [
      producto('Yerba Playadito', 20, 5),
      producto('Coca-Cola 2,25 L', 3, 8),
      producto('Fideos Matarazzo', 0, 6),
      producto('Oreo 118 g', 2, 6),
      producto('Leche', 1, 4),
    ]
    const r = porReponer(productos)
    expect(r.cantidad).toBe(4)
    expect(r.nombres).toEqual(['Fideos Matarazzo', 'Leche', 'Oreo 118 g'])
  })

  it('un producto sin mínimo definido nunca figura como faltante', () => {
    expect(porReponer([producto('Pan', 0, 0)]).cantidad).toBe(0)
  })

  it('arma la frase con el primer nombre de cada uno', () => {
    expect(listaCorta(['Coca-Cola 2,25 L', 'Oreo 118 g', 'Fideos Matarazzo'])).toBe('Coca-Cola, Oreo y Fideos')
    expect(listaCorta(['Leche 1 L', 'Pan lactal'])).toBe('Leche y Pan')
    expect(listaCorta(['Yerba'])).toBe('Yerba')
    expect(listaCorta([])).toBe('')
  })
})

describe('detalleFranjas', () => {
  it('cada franja dice su horario, cuánto se vendió y en cuántas ventas', () => {
    const ventas = [venta({ fecha: A_LAS(9), total: 250 }), venta({ fecha: A_LAS(9, 59), total: 50 }), venta({ fecha: A_LAS(13), total: 70 })]
    const detalle = detalleFranjas(ventas, HOY)
    expect(detalle).toHaveLength(8)
    expect(detalle[1]).toEqual({ desde: 8, hasta: 10, etiqueta: '8 a 10 h', monto: 300, cantidad: 2 })
    expect(detalle[3]).toMatchObject({ etiqueta: '12 a 14 h', monto: 70, cantidad: 1 })
    expect(detalle[0]).toMatchObject({ etiqueta: '6 a 8 h', monto: 0, cantidad: 0 })
  })

  it('coincide con ventasPorFranja, incluidas las ventas fuera de horario y sin contar anuladas', () => {
    const ventas = [venta({ fecha: A_LAS(3), total: 10 }), venta({ fecha: A_LAS(23), total: 20 }), venta({ total: 99, estado: 'anulada' })]
    const detalle = detalleFranjas(ventas, HOY)
    expect(detalle.map((f) => f.monto)).toEqual(ventasPorFranja(ventas, HOY))
    expect(detalle[0].cantidad).toBe(1)
    expect(detalle[7].cantidad).toBe(1)
  })
})

describe('porDebajoDelCosto', () => {
  const item = (nombre: string, precio: number, costo: number) => ({ productoId: nombre, nombre, cantidad: 1, precio, costo })
  it('nombra una sola vez los productos vendidos hoy por menos de lo que cuestan', () => {
    const ventas = [
      venta({ items: [item('Yerba', 100, 300), item('Pan', 100, 50)] }),
      venta({ items: [item('Yerba', 100, 300)] }),
    ]
    expect(porDebajoDelCosto(ventas, HOY)).toEqual(['Yerba'])
  })
  it('ignora anuladas y otros días; sin problemas devuelve vacío', () => {
    const ventas = [
      venta({ estado: 'anulada', items: [item('A', 1, 9)] }),
      venta({ fecha: new Date(2026, 9, 26, 10).getTime(), items: [item('B', 1, 9)] }),
      venta({ items: [item('C', 10, 9)] }),
    ]
    expect(porDebajoDelCosto(ventas, HOY)).toEqual([])
  })
})
