import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaStock } from '@/ui/stock/PantallaStock'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaStock', () => {
  it('da de alta un producto con precio en pesos y lo guarda en centavos', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Fideos' } })
    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '800' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '1200' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(async () => {
      const productos = await repos.productos.todos()
      expect(productos).toHaveLength(1)
      expect(productos[0].precio).toBe(120000)
    })
  })

  it('avisa cuáles productos están por debajo del mínimo', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 1, stockMinimo: 5,
    })
    render(<PantallaStock />)
    expect(await screen.findByText(/te está faltando/i)).toBeDefined()
  })

  it('no guarda un producto sin nombre', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /guardar/i }))
    await waitFor(async () => expect(await repos.productos.todos()).toHaveLength(0))
  })
})
