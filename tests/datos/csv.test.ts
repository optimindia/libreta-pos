import { describe, expect, it } from 'vitest'
import { productosACsv, productosDesdeCsv, ventasACsv } from '@/datos/local/csv'
import type { Producto, Venta } from '@/dominio/tipos'

describe('CSV del POS', () => {
  const producto: Producto = { id: 'p1', codigoBarras: '779', nombre: 'Yerba; suave', costo: 300000, precio: 420000, stock: 5, stockMinimo: 2, categoria: 'Almacén', actualizadoEn: 0 }

  it('exporta y vuelve a leer productos con separadores', () => {
    const importado = productosDesdeCsv(productosACsv([producto]))
    expect(importado[0]).toMatchObject({ nombre: 'Yerba; suave', costo: 300000, precio: 420000, categoria: 'Almacén' })
  })

  it('exporta ventas con el detalle legible', () => {
    const venta: Venta = { id: 'v1', fecha: 0, total: 420000, medioPago: 'efectivo', clienteId: null, items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 210000, costo: 150000 }] }
    expect(ventasACsv([venta])).toContain('2 x Yerba')
    expect(ventasACsv([venta])).toContain('4200.00')
  })
})

describe('productosDesdeCsv con números escritos en castellano', () => {
  it('"1.500" son mil quinientos pesos, no un peso con cincuenta', () => {
    expect(productosDesdeCsv('nombre,precio\nYerba,1.500')[0].precio).toBe(150000)
    expect(productosDesdeCsv('nombre,precio\nYerba,12.345.678')[0].precio).toBe(1234567800)
  })

  it('acepta coma decimal, signo $ y espacios', () => {
    expect(productosDesdeCsv('nombre,precio\nYerba,"1.500,50"')[0].precio).toBe(150050)
    expect(productosDesdeCsv('nombre,precio\nYerba,"$ 1500"')[0].precio).toBe(150000)
    expect(productosDesdeCsv('nombre,precio\nYerba,"4,2"')[0].precio).toBe(420)
  })

  it('sigue leyendo el formato que exporta la app (punto decimal)', () => {
    expect(productosDesdeCsv('nombre,precio\nYerba,4200.5')[0].precio).toBe(420050)
    expect(productosDesdeCsv('nombre,precio\nYerba,1.5')[0].precio).toBe(150)
  })
})
