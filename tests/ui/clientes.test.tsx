import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaClientes } from '@/ui/clientes/PantallaClientes'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaClientes', () => {
  it('permite eliminar desde la tarjeta a un cliente sin historial', async () => {
    await repos.clientes.guardar({ nombre: 'Marta', telefono: null })

    render(<PantallaClientes />)
    fireEvent.click(await screen.findByRole('button', { name: /eliminar cliente marta/i }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))

    await waitFor(async () => expect(await repos.clientes.todos()).toHaveLength(0))
    expect(await screen.findByText(/cliente eliminado/i)).toBeDefined()
  })

  it('explica por qué no elimina un cliente con fiado', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })

    render(<PantallaClientes />)
    fireEvent.click(await screen.findByRole('button', { name: /eliminar cliente marta/i }))
    fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))

    expect(await screen.findByText(/no se puede eliminar este cliente porque tiene historial/i)).toBeDefined()
    expect(await repos.clientes.todos()).toHaveLength(1)
  })
})
