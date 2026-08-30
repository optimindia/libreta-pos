import { describe, it, expect } from 'vitest'
import { credencialesDesdeTelefono, validarPin } from '@/datos/nube/sesion'

describe('credencialesDesdeTelefono', () => {
  it('arma siempre las mismas credenciales para el mismo teléfono y PIN', () => {
    const a = credencialesDesdeTelefono('261 555-1234', '123456')
    const b = credencialesDesdeTelefono('(261)5551234', '123456')
    expect(a).toEqual(b)
  })

  it('usa el teléfono normalizado con código de país', () => {
    expect(credencialesDesdeTelefono('2615551234', '123456').email)
      .toBe('542615551234@libreta.app')
  })

  it('no manda el PIN pelado como contraseña', () => {
    const { password } = credencialesDesdeTelefono('2615551234', '123456')
    expect(password).not.toBe('123456')
    expect(password.length).toBeGreaterThanOrEqual(12)
  })

  it('PIN distinto da contraseña distinta', () => {
    const a = credencialesDesdeTelefono('2615551234', '123456')
    const b = credencialesDesdeTelefono('2615551234', '654321')
    expect(a.password).not.toBe(b.password)
  })
})

describe('validarPin', () => {
  it('acepta seis dígitos', () => {
    expect(validarPin('123456')).toBe(true)
  })

  it('rechaza menos de seis dígitos', () => {
    expect(validarPin('1234')).toBe(false)
  })

  it('rechaza cualquier cosa que no sean números', () => {
    expect(validarPin('12345a')).toBe(false)
  })

  it('rechaza los PIN obvios, que son los que se adivinan primero', () => {
    expect(validarPin('123456')).toBe(true)
    expect(validarPin('000000')).toBe(false)
    expect(validarPin('111111')).toBe(false)
  })
})
