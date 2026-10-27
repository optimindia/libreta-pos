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
