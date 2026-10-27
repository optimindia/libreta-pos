import { describe, it, expect } from 'vitest'
import { validarPedido, normalizarItems, MAX_IMAGEN_DATA_URL } from '@/app/api/factura/validacion'

describe('validarPedido', () => {
  it('rechaza un pedido sin imagen', () => {
    expect(validarPedido({})).toEqual({ ok: false, motivo: 'falta la imagen' })
  })

  it('rechaza una imagen que no es base64 de imagen', () => {
    expect(validarPedido({ imagenBase64: 'hola' })).toEqual({
      ok: false, motivo: 'la imagen no es válida',
    })
  })

  it('acepta un data URL de imagen', () => {
    expect(validarPedido({ imagenBase64: 'data:image/jpeg;base64,/9j/4AAQ' }).ok).toBe(true)
  })

  it('rechaza formatos no soportados y payloads demasiado grandes', () => {
    expect(validarPedido({ imagenBase64: 'data:image/svg+xml;base64,PHN2Zy8+' })).toEqual({
      ok: false, motivo: 'la imagen no es válida',
    })
    expect(validarPedido({ imagenBase64: `data:image/jpeg;base64,${'A'.repeat(MAX_IMAGEN_DATA_URL)}` })).toEqual({
      ok: false, motivo: 'la imagen es demasiado grande',
    })
  })
})

describe('normalizarItems', () => {
  it('convierte los precios en pesos a centavos', () => {
    const items = normalizarItems([{ nombre: 'Yerba', cantidad: 6, costoUnitario: 3000 }])
    expect(items[0].costoUnitario).toBe(300000)
  })

  it('descarta las filas sin nombre o con cantidad cero', () => {
    const items = normalizarItems([
      { nombre: '', cantidad: 6, costoUnitario: 3000 },
      { nombre: 'Fideos', cantidad: 0, costoUnitario: 1000 },
      { nombre: 'Azúcar', cantidad: 2, costoUnitario: 1500 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].nombre).toBe('Azúcar')
  })

  it('redondea cantidades fraccionarias hacia abajo', () => {
    const items = normalizarItems([{ nombre: 'Pan', cantidad: 2.7, costoUnitario: 900 }])
    expect(items[0].cantidad).toBe(2)
  })

  it('descarta lo que no tenga forma de item, sin romper', () => {
    const items = normalizarItems([null, 'texto', { nombre: 'Sal', cantidad: 1, costoUnitario: 500 }] as never)
    expect(items).toHaveLength(1)
  })

  it('descarta valores no finitos o fuera de rango', () => {
    const items = normalizarItems([
      { nombre: 'Infinito', cantidad: Number.POSITIVE_INFINITY, costoUnitario: 500 },
      { nombre: 'Costo negativo', cantidad: 1, costoUnitario: -1 },
      { nombre: 'Válido', cantidad: 1, costoUnitario: 500 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].nombre).toBe('Válido')
  })
})
