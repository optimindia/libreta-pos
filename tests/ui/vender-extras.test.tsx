import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaVender } from '@/ui/vender/PantallaVender'
import { violacionesAxe } from './axe'

beforeEach(async () => {
  window.localStorage.clear()
  await db.delete()
  await db.open()
  await repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba Playadito', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3 })
  await repos.productos.guardar({ codigoBarras: null, nombre: 'Pan francés', costo: 50000, precio: 90000, stock: 20, stockMinimo: 3 })
})

const venta = () => screen.getByRole('complementary', { name: 'Venta en curso' })

describe('Monto libre', () => {
  it('suma un importe como "Varios" y se puede cobrar', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /monto libre/i }))
    const hoja = await screen.findByRole('dialog', { name: 'Monto libre' })
    fireEvent.change(within(hoja).getByLabelText('Importe del monto libre'), { target: { value: '1500' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Sumar $1.500' }))

    await waitFor(() => expect(within(venta()).getByText('Varios')).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Monto libre' })).toBeNull()
    // No aparece en el catálogo y el ticket se puede cobrar.
    expect(screen.queryByRole('button', { name: /^Varios/ })).toBeNull()
    expect((within(venta()).getByRole('button', { name: /^Cobrar \$1\.500/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('los montos rápidos completan el importe', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /monto libre/i }))
    const hoja = await screen.findByRole('dialog', { name: 'Monto libre' })
    fireEvent.click(within(hoja).getByRole('button', { name: '$2.000' }))
    expect(within(hoja).getByRole('button', { name: 'Sumar $2.000' })).toBeTruthy()
    expect(await violacionesAxe(hoja)).toEqual([])
  })
})

describe('Deshacer', () => {
  it('después de agregar, "Deshacer" vuelve el ticket como estaba', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Yerba Playadito/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Quitar uno de Yerba/ })).toBeNull())
  })

  it('al quitar el último producto se puede recuperar', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Yerba Playadito/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Quitar uno de Yerba/ }))
    expect(await screen.findByText('Quitaste Yerba Playadito')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Quitar uno de Yerba/ })).toBeTruthy())
  })
})

describe('Cantidad exacta', () => {
  it('se toca el número y se escribe la cantidad', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Pan francés/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^1 unidades de Pan francés/ }))
    const campo = screen.getByLabelText('Cantidad de Pan francés')
    fireEvent.change(campo, { target: { value: '12' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(await screen.findByRole('button', { name: /^12 unidades de Pan francés/ })).toBeTruthy()
    await waitFor(() => expect(within(venta()).getAllByText('$10.800').length).toBeGreaterThan(0))
  })

  it('nunca se pasa del stock: queda en el máximo y avisa', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Yerba Playadito/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^1 unidades de Yerba/ }))
    const campo = screen.getByLabelText('Cantidad de Yerba Playadito')
    fireEvent.change(campo, { target: { value: '50' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(await screen.findByRole('button', { name: /^10 unidades de Yerba/ })).toBeTruthy()
  })
})
