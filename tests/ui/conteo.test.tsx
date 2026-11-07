import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { cantidadContada, resumenConteo } from '@/dominio/conteo'
import type { Producto } from '@/dominio/tipos'
import { ConteoInventario } from '@/ui/stock/ConteoInventario'

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
})
afterEach(() => cleanup())

describe('dominio del conteo', () => {
  const p = (parcial: Partial<Producto>) => ({ id: 'x', codigoBarras: null, nombre: 'X', costo: 1000, precio: 2000, stock: 10, stockMinimo: 0, actualizadoEn: 0, ...parcial }) as Producto
  it('sólo enteros en los de unidad, decimales en los de kilo', () => {
    expect(cantidadContada(p({}), '3')).toBe(3)
    expect(cantidadContada(p({}), '2,5')).toBeNull()
    expect(cantidadContada(p({ unidad: 'kg' }), '2,5')).toBe(2.5)
    expect(cantidadContada(p({}), '-1')).toBeNull()
  })
  it('suma el faltante y el sobrante a costo', () => {
    const r = resumenConteo([p({ id: 'a', stock: 10 }), p({ id: 'b', stock: 4 }), p({ id: 'c', stock: 2 })], { a: 7, b: 4, c: 3 })
    expect(r.contados).toBe(3)
    expect(r.conDiferencia.map((d) => d.producto.id)).toEqual(['a', 'c'])
    expect(r.faltante).toBe(3000)
    expect(r.sobrante).toBe(1000)
  })
})

describe('pantalla de conteo', () => {
  it('cuenta, escanea y corrige el stock de lo que no coincide', async () => {
    const yerba = await repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba', costo: 300000, precio: 450000, stock: 10, stockMinimo: 1 })
    const arroz = await repos.productos.guardar({ codigoBarras: null, nombre: 'Arroz', costo: 100000, precio: 150000, stock: 5, stockMinimo: 1 })
    render(<ConteoInventario productos={[yerba, arroz]} />)
    fireEvent.change(screen.getByLabelText('Contado de Arroz'), { target: { value: '5' } })
    const escaner = screen.getByLabelText('Buscar o escanear producto para contar')
    for (let i = 0; i < 8; i++) {
      fireEvent.change(escaner, { target: { value: '779' } })
      fireEvent.keyDown(escaner, { key: 'Enter' })
    }
    expect((screen.getByLabelText('Contado de Yerba') as HTMLInputElement).value).toBe('8')
    expect(JSON.parse(window.localStorage.getItem('libreta.conteo') ?? '{}')).toMatchObject({ [yerba.id]: '8' })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y cerrar conteo' }))
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByText('$6.000')).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Corregir 1 producto' }))
    await waitFor(async () => expect((await db.productos.get(yerba.id))?.stock).toBe(8))
    expect((await db.productos.get(arroz.id))?.stock).toBe(5)
    expect(window.localStorage.getItem('libreta.conteo')).toBeNull()
  })
})
