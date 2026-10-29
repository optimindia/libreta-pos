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
    expect((await screen.findAllByText('Marta')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('$5.000')).length).toBeGreaterThanOrEqual(1)
  })

  it('registrar un pago total saca al cliente de la lista', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /cobrar todo/i }))
    await waitFor(async () => expect(await repos.fiados.abiertos()).toHaveLength(0))
  })

  it('permite registrar un pago parcial', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /registrar pago/i }))
    fireEvent.change(await screen.findByLabelText(/pago de marta/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar pago/i }))

    await waitFor(async () => {
      expect((await repos.fiados.abiertos())[0].saldo).toBe(300000)
    })
  })

  it('un pago escrito "2.000" son dos mil pesos, no dos', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /registrar pago/i }))
    fireEvent.change(await screen.findByLabelText(/pago de marta/i), { target: { value: '2.000' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar pago/i }))

    await waitFor(async () => {
      expect((await repos.fiados.abiertos())[0].saldo).toBe(300000)
    })
  })

  it('muestra el enlace de WhatsApp con el mensaje ya escrito', async () => {
    render(<PantallaFiados />)
    const enlace = (await screen.findByRole('link', { name: /mandar mensaje/i })) as HTMLAnchorElement
    expect(enlace.href).toContain('wa.me/542615551234')
    expect(decodeURIComponent(enlace.href)).toContain('Marta')
  })

  it('permite editar el teléfono y ver los movimientos del cliente', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /editar cliente/i }))
    fireEvent.change(await screen.findByLabelText('Teléfono del cliente'), { target: { value: '2614440000' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }))
    await waitFor(async () => expect((await repos.clientes.todos())[0].telefono).toBe('2614440000'))

    expect(await screen.findByRole('heading', { name: /movimientos/i })).toBeDefined()
    expect(await screen.findByText(/todavía no hay movimientos/i)).toBeDefined()
  })

  it('el límite de fiado "30.000" son treinta mil pesos y "30,5" no se pierde', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /editar cliente/i }))
    fireEvent.change(await screen.findByLabelText('Límite de fiado'), { target: { value: '30.000' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }))
    await waitFor(async () => expect((await repos.clientes.todos())[0].limiteFiado).toBe(3000000))

    fireEvent.click(await screen.findByRole('button', { name: /editar cliente/i }))
    fireEvent.change(await screen.findByLabelText('Límite de fiado'), { target: { value: '30,5' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }))
    await waitFor(async () => expect((await repos.clientes.todos())[0].limiteFiado).toBe(3050))
  })
})
