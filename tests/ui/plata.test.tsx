import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaPlata } from '@/ui/plata/PantallaPlata'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaPlata', () => {
  it('muestra lo vendido y lo ganado del día', async () => {
    const producto = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
    })
    await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }],
    })
    render(<PantallaPlata />)
    // $4.200 sale dos veces y está bien: es lo vendido y es el total en efectivo.
    expect((await screen.findAllByText('$4.200')).length).toBe(2)
    expect(await screen.findByText('$1.200')).toBeDefined()
  })

  it('sin ventas no rompe: muestra cero', async () => {
    render(<PantallaPlata />)
    expect((await screen.findAllByText('$0')).length).toBeGreaterThan(0)
  })

  it('lista lo que hay que reponer', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Fideos', costo: 80000, precio: 120000, stock: 1, stockMinimo: 5,
    })
    render(<PantallaPlata />)
    expect(await screen.findByText(/Fideos/)).toBeDefined()
  })
})
