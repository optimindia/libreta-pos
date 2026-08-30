import { describe, it, expect } from 'vitest'
import { formatearPesos, pesosACentavos, sumar, multiplicar, vuelto } from '@/dominio/dinero'

describe('formatearPesos', () => {
  it('usa punto de miles y no muestra centavos cuando son cero', () => {
    expect(formatearPesos(420000)).toBe('$4.200')
    expect(formatearPesos(18740000)).toBe('$187.400')
  })

  it('muestra los centavos solamente si existen', () => {
    expect(formatearPesos(420050)).toBe('$4.200,50')
  })

  it('formatea el cero', () => {
    expect(formatearPesos(0)).toBe('$0')
  })

  it('formatea negativos con el signo antes del peso', () => {
    expect(formatearPesos(-150000)).toBe('-$1.500')
  })
})

describe('aritmética en centavos', () => {
  it('convierte pesos a centavos sin error de coma flotante', () => {
    expect(pesosACentavos(4200.1)).toBe(420010)
    expect(pesosACentavos(0.29)).toBe(29)
  })

  it('suma sin acumular error', () => {
    expect(sumar(10, 20, 29)).toBe(59)
  })

  it('multiplica por cantidad y redondea al centavo', () => {
    expect(multiplicar(90000, 2)).toBe(180000)
    expect(multiplicar(33333, 3)).toBe(99999)
  })
})

describe('vuelto', () => {
  it('devuelve lo que sobra del pago', () => {
    expect(vuelto(100000, 77000)).toBe(23000)
  })

  it('es cero cuando paga justo', () => {
    expect(vuelto(77000, 77000)).toBe(0)
  })

  it('negativo cuando alcanza justo para arriba: no hay vuelto', () => {
    expect(vuelto(50000, 77000)).toBe(-27000)
  })
})
