import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Etiquetas } from '@/ui/stock/Etiquetas'
import { etiquetaDe, hojasNecesarias, productosParaEtiquetas, ultimoCambioDePrecio } from '@/dominio/etiquetas'
import type { Producto } from '@/dominio/tipos'

afterEach(() => cleanup())

const AHORA = Date.now()
const DIA = 86_400_000

function producto(parcial: Partial<Producto>): Producto {
  return { id: parcial.nombre ?? 'p', codigoBarras: null, nombre: 'X', costo: 100, precio: 100000, stock: 1, stockMinimo: 0, actualizadoEn: 0, ...parcial } as Producto
}

const yerba = producto({ id: 'y', nombre: 'Yerba', precio: 450000, codigoBarras: '779', historialPrecios: [{ fecha: AHORA - 30 * DIA, precio: 420000, costo: 1 }, { fecha: AHORA - 2 * DIA, precio: 450000, costo: 1 }] })
const queso = producto({ id: 'q', nombre: 'Queso', precio: 1200000, unidad: 'kg', precioOferta: 990000 })
const arroz = producto({ id: 'a', nombre: 'Arroz', precio: 150000 })
const sinPrecio = producto({ id: 's', nombre: 'Sin precio', precio: 0 })

describe('dominio de etiquetas', () => {
  it('elige por cambio reciente, oferta o todos, y nunca sin precio', () => {
    const todos = [yerba, queso, arroz, sinPrecio]
    expect(productosParaEtiquetas(todos, 'cambiados', AHORA - 7 * DIA, AHORA).map((p) => p.id)).toEqual(['y'])
    expect(productosParaEtiquetas(todos, 'oferta', 0, AHORA).map((p) => p.id)).toEqual(['q'])
    expect(productosParaEtiquetas(todos, 'todos', 0, AHORA).map((p) => p.id)).toEqual(['a', 'q', 'y'])
  })

  it('la etiqueta de una oferta por kilo muestra el precio de antes y la medida', () => {
    expect(etiquetaDe(queso, AHORA)).toMatchObject({ precio: 990000, antes: 1200000, medida: 'el kilo' })
    expect(etiquetaDe(arroz, AHORA)).toMatchObject({ antes: null, medida: '' })
  })

  it('un cambio sólo de costo no cuenta como cambio de precio', () => {
    expect(ultimoCambioDePrecio(producto({ historialPrecios: [{ fecha: 1, precio: 5, costo: 1 }, { fecha: 2, precio: 5, costo: 2 }] }))).toBeNull()
    expect(hojasNecesarias(25, 'chica')).toBe(2)
  })
})

describe('pantalla de etiquetas', () => {
  it('arranca con los precios que cambiaron e imprime los elegidos', () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<Etiquetas productos={[yerba, queso, arroz]} />)
    expect(screen.getByRole('button', { name: 'Imprimir 1 etiqueta · 1 hoja' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Todos \(3\)/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Arroz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir 2 etiquetas · 1 hoja' }))
    expect(imprimir).toHaveBeenCalledTimes(1)
    const impresas = document.body.querySelector('.f-etiquetas-impresas') as HTMLElement
    expect(within(impresas).getAllByText(/Queso|Yerba/)).toHaveLength(2)
    expect(within(impresas).queryByText('Arroz')).toBeNull()
    imprimir.mockRestore()
  })
})
