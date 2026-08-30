import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { CierreCaja } from '@/ui/plata/CierreCaja'

beforeEach(async () => {
  await db.delete()
  await db.open()
  const yerba = await repos.productos.guardar({
    codigoBarras: '779', nombre: 'Yerba Playadito',
    costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
  })
  await repos.ventas.registrar({
    items: [{ productoId: yerba.id, nombre: 'Yerba Playadito', cantidad: 1, precio: 420000, costo: 300000 }],
    medioPago: 'efectivo',
    clienteId: null,
  })
})

describe('CierreCaja', () => {
  it('dice cuánto debería haber en el cajón según las ventas del día', async () => {
    render(<CierreCaja />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar caja/i }))
    expect(await screen.findByText('Esperado')).toBeDefined()
    expect((await screen.findAllByText('$4.200')).length).toBe(2)
  })

  it('cuadra cuando se cuenta lo esperado y guarda el cierre', async () => {
    render(<CierreCaja />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar caja/i }))
    fireEvent.change(await screen.findByLabelText(/cuánto contaste/i), { target: { value: '4200' } })
    expect(await screen.findByText(/la caja cuadra/i)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /guardar cierre/i }))
    await waitFor(async () => expect(await repos.cierres.todos()).toHaveLength(1))
    expect(await screen.findByRole('button', { name: /cerrar caja/i })).toBeDefined()
  })

  it('si falta plata lo marca en ámbar y lo deja igual guardar', async () => {
    render(<CierreCaja />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar caja/i }))
    fireEvent.change(await screen.findByLabelText(/cuánto contaste/i), { target: { value: '4000' } })
    expect(await screen.findByText(/te faltó/i)).toBeDefined()
    expect(screen.getByText('$200')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /guardar cierre/i }))
    await waitFor(async () => expect(await repos.cierres.todos()).toHaveLength(1))
  })

  it('el fondo del día siguiente arranca en lo contado del cierre anterior', async () => {
    render(<CierreCaja />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar caja/i }))
    fireEvent.change(await screen.findByLabelText(/cuánto contaste/i), { target: { value: '4200' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cierre/i }))
    await waitFor(async () => expect(await repos.cierres.todos()).toHaveLength(1))

    fireEvent.click(await screen.findByRole('button', { name: /cerrar caja/i }))
    expect((await screen.findByLabelText(/fondo inicial/i) as HTMLInputElement).value).toBe('4200')
  })
})