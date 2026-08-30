import { describe, it, expect } from 'vitest'
import { saldoFiado, estaSaldado, diasDeAntiguedad, deudaPorCliente } from '@/dominio/fiado'
import type { Fiado, FiadoPago } from '@/dominio/tipos'

const AHORA = new Date('2026-08-30T12:00:00').getTime()
const DIA = 24 * 60 * 60 * 1000

const fiado: Fiado = {
  id: 'f1', clienteId: 'c1', ventaId: 'v1',
  monto: 500000, fecha: AHORA - 10 * DIA, vence: null,
}

describe('saldoFiado', () => {
  it('sin pagos, el saldo es el monto completo', () => {
    expect(saldoFiado(fiado, [])).toBe(500000)
  })

  it('descuenta los pagos parciales', () => {
    const pagos: FiadoPago[] = [
      { id: 'g1', fiadoId: 'f1', monto: 200000, fecha: AHORA },
      { id: 'g2', fiadoId: 'f1', monto: 100000, fecha: AHORA },
    ]
    expect(saldoFiado(fiado, pagos)).toBe(200000)
  })

  it('ignora los pagos de otro fiado', () => {
    const pagos: FiadoPago[] = [{ id: 'g1', fiadoId: 'OTRO', monto: 200000, fecha: AHORA }]
    expect(saldoFiado(fiado, pagos)).toBe(500000)
  })

  it('un pago de más no deja el saldo en negativo', () => {
    const pagos: FiadoPago[] = [{ id: 'g1', fiadoId: 'f1', monto: 900000, fecha: AHORA }]
    expect(saldoFiado(fiado, pagos)).toBe(0)
  })
})

describe('estaSaldado', () => {
  it('es verdadero cuando el saldo llega a cero', () => {
    const pagos: FiadoPago[] = [{ id: 'g1', fiadoId: 'f1', monto: 500000, fecha: AHORA }]
    expect(estaSaldado(fiado, pagos)).toBe(true)
  })

  it('es falso si queda aunque sea un peso', () => {
    const pagos: FiadoPago[] = [{ id: 'g1', fiadoId: 'f1', monto: 499900, fecha: AHORA }]
    expect(estaSaldado(fiado, pagos)).toBe(false)
  })
})

describe('diasDeAntiguedad', () => {
  it('cuenta los días desde que se anotó', () => {
    expect(diasDeAntiguedad(fiado, AHORA)).toBe(10)
  })

  it('un fiado de hoy tiene cero días', () => {
    expect(diasDeAntiguedad({ ...fiado, fecha: AHORA }, AHORA)).toBe(0)
  })
})

describe('deudaPorCliente', () => {
  it('junta varios fiados del mismo cliente en un solo saldo', () => {
    const fiados: Fiado[] = [
      fiado,
      { ...fiado, id: 'f2', monto: 300000, fecha: AHORA - 2 * DIA },
    ]
    const deudas = deudaPorCliente(fiados, [], AHORA)
    expect(deudas).toHaveLength(1)
    expect(deudas[0].saldo).toBe(800000)
  })

  it('informa la antigüedad del fiado más viejo del cliente', () => {
    const fiados: Fiado[] = [
      fiado,
      { ...fiado, id: 'f2', monto: 300000, fecha: AHORA - 2 * DIA },
    ]
    expect(deudaPorCliente(fiados, [], AHORA)[0].diasDelMasViejo).toBe(10)
  })

  it('no lista clientes que ya pagaron todo', () => {
    const pagos: FiadoPago[] = [{ id: 'g1', fiadoId: 'f1', monto: 500000, fecha: AHORA }]
    expect(deudaPorCliente([fiado], pagos, AHORA)).toHaveLength(0)
  })

  it('ordena de mayor a menor deuda', () => {
    const fiados: Fiado[] = [
      { ...fiado, id: 'f1', clienteId: 'c1', monto: 100000 },
      { ...fiado, id: 'f2', clienteId: 'c2', monto: 900000 },
    ]
    const deudas = deudaPorCliente(fiados, [], AHORA)
    expect(deudas[0].clienteId).toBe('c2')
  })
})
