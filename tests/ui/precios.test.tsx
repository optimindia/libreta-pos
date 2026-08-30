import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { ActualizarPrecios } from '@/ui/stock/ActualizarPrecios'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.productos.guardar({
    codigoBarras: '779', nombre: 'Yerba Playadito',
    costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
  })
  await repos.productos.guardar({
    codigoBarras: '780', nombre: 'Fideos Canale',
    costo: 60000, precio: 89000, stock: 10, stockMinimo: 3,
  })
})

describe('ActualizarPrecios', () => {
  it('muestra la vista previa con el precio nuevo antes de tocar nada', async () => {
    render(<ActualizarPrecios />)
    fireEvent.click(await screen.findByRole('button', { name: /ver los 2 precios que cambian/i }))
    expect(await screen.findByText('Yerba Playadito')).toBeDefined()
    expect(screen.getByText('$4.620')).toBeDefined()
    expect(screen.getByRole('button', { name: /actualizar 2 precios/i })).toBeDefined()
  })

  it('aplica el aumento a los precios de los productos', async () => {
    render(<ActualizarPrecios />)
    fireEvent.click(await screen.findByRole('button', { name: /ver los 2 precios que cambian/i }))
    fireEvent.click(await screen.findByRole('button', { name: /actualizar 2 precios/i }))
    await waitFor(async () => {
      const productos = await repos.productos.todos()
      expect(productos.find((p) => p.nombre === 'Yerba Playadito')?.precio).toBe(462000)
      expect(productos.find((p) => p.nombre === 'Fideos Canale')?.precio).toBe(98000)
    })
    expect(await screen.findByText(/se actualizaron 2 precios/i)).toBeDefined()
  })

  it('un producto desmarcado queda con su precio original', async () => {
    render(<ActualizarPrecios />)
    fireEvent.click(await screen.findByRole('button', { name: /ver los 2 precios que cambian/i }))
    fireEvent.click(await screen.findByText('Fideos Canale'))
    fireEvent.click(await screen.findByRole('button', { name: /actualizar 1 precio/i }))
    await waitFor(async () => {
      const productos = await repos.productos.todos()
      expect(productos.find((p) => p.nombre === 'Fideos Canale')?.precio).toBe(89000)
      expect(productos.find((p) => p.nombre === 'Yerba Playadito')?.precio).toBe(462000)
    })
  })

  it('desde el costo recalcula el precio con el margen elegido', async () => {
    render(<ActualizarPrecios />)
    fireEvent.click(await screen.findByRole('button', { name: /desde el costo/i }))
    fireEvent.change(await screen.findByLabelText(/margen sobre el costo/i), { target: { value: '25' } })
    fireEvent.click(await screen.findByRole('button', { name: /ver los 2 precios que cambian/i }))
    expect(await screen.findByText('$3.750')).toBeDefined()
    fireEvent.click(await screen.findByRole('button', { name: /actualizar 2 precios/i }))
    await waitFor(async () => {
      const productos = await repos.productos.todos()
      expect(productos.find((p) => p.nombre === 'Yerba Playadito')?.precio).toBe(375000)
    })
  })
})