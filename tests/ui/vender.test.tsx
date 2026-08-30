import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaVender } from '@/ui/vender/PantallaVender'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.productos.guardar({
    codigoBarras: '779', nombre: 'Yerba Playadito',
    costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
  })
})

describe('PantallaVender', () => {
  it('empieza con el ticket vacío y el total en cero', async () => {
    render(<PantallaVender />)
    expect(await screen.findByText('$0')).toBeDefined()
  })

  it('agregar un producto lo muestra en el ticket y suma al total', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    await waitFor(() => expect(screen.getAllByText('$4.200').length).toBeGreaterThan(0))
  })

  it('cobrar registra la venta y vacía el ticket', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /efectivo/i }))
    await waitFor(async () => expect(await repos.ventas.todas()).toHaveLength(1))
  })

  it('no deja cobrar un ticket vacío', async () => {
    render(<PantallaVender />)
    const boton = await screen.findByRole('button', { name: /^cobrar$/i })
    expect(boton).toHaveProperty('disabled', true)
  })
})
