import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaFiados } from '@/ui/fiados/PantallaFiados'

beforeEach(async () => {
  await db.delete()
  await db.open()
  const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: '2615551234' })
  await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
})

describe('PantallaFiados', () => {
  it('lista a quién le debe y cuánto', async () => {
    render(<PantallaFiados />)
    expect(await screen.findByText('Marta')).toBeDefined()
    expect(await screen.findByText('$5.000')).toBeDefined()
  })

  it('registrar un pago total saca al cliente de la lista', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /cobrar todo/i }))
    await waitFor(async () => expect(await repos.fiados.abiertos()).toHaveLength(0))
  })

  it('muestra el enlace de WhatsApp con el mensaje ya escrito', async () => {
    render(<PantallaFiados />)
    const enlace = (await screen.findByRole('link', { name: /mandar mensaje/i })) as HTMLAnchorElement
    expect(enlace.href).toContain('wa.me/542615551234')
    expect(decodeURIComponent(enlace.href)).toContain('Marta')
  })
})
