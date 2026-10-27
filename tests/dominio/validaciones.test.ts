import { describe, expect, it } from 'vitest'
import { hayErroresProducto, validarProducto } from '@/dominio/validaciones'

const base = { nombre: 'Yerba', costo: 30000, precio: 50000, codigoBarras: '779', stockMinimo: 3 }

describe('validarProducto', () => {
  it('rechaza datos incompletos o negativos', () => {
    const errores = validarProducto({ ...base, nombre: '', precio: -1, stockMinimo: 1.5 })
    expect(errores.nombre).toBeTruthy()
    expect(errores.precio).toBeTruthy()
    expect(errores.stockMinimo).toBeTruthy()
    expect(hayErroresProducto(errores)).toBe(true)
  })

  it('detecta nombres y códigos repetidos sin marcar la propia edición', () => {
    const existente = { id: 'p1', ...base, stock: 0, actualizadoEn: 0 }
    expect(validarProducto(base, [existente])).toHaveProperty('nombre')
    expect(validarProducto({ ...base, nombre: 'Yerba nueva' }, [existente], 'p1')).toEqual({})
    expect(validarProducto({ ...base, nombre: 'Otra' }, [existente])).toHaveProperty('codigoBarras')
  })
})
