import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { buscarEnTodo, coincidencia } from '@/dominio/buscador'
import { formatearPesos } from '@/dominio/dinero'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
const { BuscadorGeneral } = await import('@/ui/sistema/BuscadorGeneral')

beforeEach(async () => {
  await db.delete()
  await db.open()
  push.mockClear()
})
afterEach(() => cleanup())

describe('coincidencia', () => {
  it('prefiere el principio, después el comienzo de una palabra y después el medio', () => {
    expect(coincidencia('Yerba Playadito', 'yer')).toBe(3)
    expect(coincidencia('Yerba Playadito', 'play')).toBe(2)
    expect(coincidencia('Yerba Playadito', 'adit')).toBe(1)
    expect(coincidencia('Yerba Playadito', 'yerba mate')).toBe(0)
    expect(coincidencia('Azúcar Ledesma', 'azucar')).toBe(3)
  })
})

describe('buscarEnTodo', () => {
  it('encuentra un producto por código y a un cliente por teléfono, y manda al que debe a Fiados', () => {
    const grupos = buscarEnTodo('7790', {
      secciones: [],
      productos: [{ id: 'p', codigoBarras: '7790387000135', nombre: 'Yerba', costo: 1, precio: 450000, stock: 3, stockMinimo: 1, actualizadoEn: 0 }],
      clientes: [{ id: 'c', nombre: 'Marta', telefono: '261 779 0000' }],
      proveedores: [],
      deudas: new Map([['c', 500000]]),
      formatearPesos,
    })
    expect(grupos.map((g) => g.tipo)).toEqual(['producto', 'cliente'])
    expect(grupos[1].resultados[0]).toMatchObject({ detalle: 'Debe $5.000', href: '/fiados?cliente=c' })
  })

  it('encuentra secciones por sus sinónimos', () => {
    const grupos = buscarEnTodo('deudas', { secciones: [{ id: 'fiados', texto: 'Fiados', href: '/fiados', sinonimos: ['deudas'] }], productos: [], clientes: [], proveedores: [], deudas: new Map(), formatearPesos })
    expect(grupos[0].resultados[0].href).toBe('/fiados')
  })
})

describe('BuscadorGeneral', () => {
  it('se abre con Ctrl+K, busca y lleva al producto con Enter', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Fideos Matarazzo', costo: 1, precio: 189000, stock: 4, stockMinimo: 1 })
    render(<BuscadorGeneral secciones={[]} conProveedores />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const campo = await screen.findByLabelText('Buscar en todo Libreta')
    fireEvent.change(campo, { target: { value: 'fide' } })
    expect(await screen.findByText('Fideos Matarazzo')).toBeTruthy()
    fireEvent.keyDown(campo, { key: 'Enter' })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/stock?buscar=Fideos%20Matarazzo'))
  })
})
