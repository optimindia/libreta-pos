import { describe, it, expect } from 'vitest'
import { conPuntos, soloDigitos, sugerenciasDePago, teclear } from '@/dominio/cobro'

describe('sugerenciasDePago', () => {
  it('redondea el total hacia arriba a los billetes más comunes', () => {
    // $13.050 → $14.000, $15.000, $20.000
    expect(sugerenciasDePago(1305000)).toEqual([1400000, 1500000, 2000000])
  })

  it('no repite valores ni sugiere el pago justo', () => {
    // $10.000 justo: los redondeos a 1.000, 5.000 y 10.000 dan lo mismo y no cuentan
    expect(sugerenciasDePago(1000000)).toEqual([2000000, 5000000])
  })

  it('un total chico sugiere billetes chicos', () => {
    expect(sugerenciasDePago(125000)).toEqual([200000, 500000, 1000000])
  })

  it('un total con centavos sigue rindiendo billetes enteros', () => {
    expect(sugerenciasDePago(125050)).toEqual([200000, 500000, 1000000])
  })

  it('respeta la cantidad pedida', () => {
    expect(sugerenciasDePago(1305000, 2)).toEqual([1400000, 1500000])
  })
})

describe('teclear', () => {
  it('suma dígitos y también el 000', () => {
    expect(teclear('', '2')).toBe('2')
    expect(teclear('2', '000')).toBe('2000')
  })

  it('no deja ceros a la izquierda', () => {
    expect(teclear('', '0')).toBe('')
    expect(teclear('', '000')).toBe('')
    expect(teclear('0', '5')).toBe('5')
  })

  it('borra de a un dígito y no falla con vacío', () => {
    expect(teclear('2500', 'borrar')).toBe('250')
    expect(teclear('', 'borrar')).toBe('')
  })

  it('corta en siete dígitos', () => {
    expect(teclear('1234567', '8')).toBe('1234567')
    expect(teclear('123456', '000')).toBe('123456')
  })
})

describe('soloDigitos y conPuntos', () => {
  it('limpia lo que se escribe a mano', () => {
    expect(soloDigitos('$ 5.000')).toBe('5000')
    expect(soloDigitos('abc')).toBe('')
    expect(soloDigitos('007')).toBe('7')
  })

  it('muestra los miles con punto', () => {
    expect(conPuntos('20000')).toBe('20.000')
    expect(conPuntos('')).toBe('')
  })
})
