import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { Proveedores } from '@/ui/stock/Proveedores'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => cleanup())

describe('Pantalla de proveedores', () => {
  it('carga un proveedor, le asigna un producto que falta y ofrece mandar el pedido', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba Playadito', costo: 1, precio: 2, stock: 1, stockMinimo: 6 })
    render(<Proveedores />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar el primero' }))
    fireEvent.change(screen.getByLabelText('Nombre del proveedor'), { target: { value: 'Distribuidora Norte' } })
    fireEvent.change(screen.getByLabelText('Teléfono del proveedor'), { target: { value: '261 555 1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }))
    fireEvent.change(await screen.findByLabelText('Buscar producto para agregar'), { target: { value: 'yerba' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar Yerba Playadito a Distribuidora Norte' }))
    const enlace = await screen.findByRole('link', { name: /Mandar pedido por WhatsApp/ })
    expect(enlace.getAttribute('href')).toContain('wa.me/542615551234')
    await waitFor(async () => expect((await repos.productos.todos())[0].proveedorId).toBeDefined())
  })
})
