import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import type { AdminCuenta, AdminSolicitud } from '@/datos/nube/admin'

const llamadas: AdminSolicitud[] = []
let vendedores: NonNullable<AdminCuenta['vendedores']> = []

function cuenta(): AdminCuenta {
  return {
    id: 'neg-1', nombre: 'Almacén Don José', telefono: '5492615550000', notaInterna: null,
    creadoEn: '2026-10-01T00:00:00Z', suscripcion: null, estado: 'activa', diasRestantes: 20, vendedores,
  }
}

vi.mock('@/datos/nube/sesion', () => ({ cerrarSesion: vi.fn() }))
vi.mock('@/datos/nube/admin', () => ({
  adminAccion: vi.fn(async (solicitud: AdminSolicitud) => {
    llamadas.push(solicitud)
    if (solicitud.accion === 'listar') return { ok: true, cuentas: [cuenta()], eventos: [], planes: [] }
    if (solicitud.accion === 'vendedor' && solicitud.operacion === 'agregar') {
      vendedores = [...vendedores, { usuarioId: 'u-2', nombre: solicitud.nombre, telefono: '5492615551111', creadoEn: '2026-10-28T00:00:00Z' }]
      return { ok: true, vendedor: { usuarioId: 'u-2', nombre: solicitud.nombre, telefono: '5492615551111' }, credenciales: { telefono: '5492615551111', pin: solicitud.pin } }
    }
    if (solicitud.accion === 'vendedor' && solicitud.operacion === 'quitar') {
      vendedores = vendedores.filter((v) => v.usuarioId !== solicitud.usuarioId)
      return { ok: true }
    }
    if (solicitud.accion === 'vendedor' && solicitud.operacion === 'pin') return { ok: true, credenciales: { telefono: '5492615551111', pin: solicitud.pin } }
    throw new Error('inesperado')
  }),
}))

import { PanelAdmin } from '@/ui/admin/PanelAdmin'

async function abrirVendedores() {
  render(<PanelAdmin />)
  fireEvent.click(await screen.findByRole('button', { name: /vendedores/i }))
  return screen.getByRole('dialog')
}

describe('Panel admin · vendedores', () => {
  beforeEach(() => { llamadas.length = 0; vendedores = [] })

  it('agrega un vendedor y muestra su acceso para mandarlo', async () => {
    const dialogo = await abrirVendedores()
    expect(within(dialogo).getByText(/sólo el dueño entra/i)).toBeTruthy()

    fireEvent.change(within(dialogo).getByLabelText(/nombre/i), { target: { value: 'Lucía' } })
    fireEvent.change(within(dialogo).getByLabelText(/teléfono/i), { target: { value: '261 555 1111' } })
    fireEvent.change(within(dialogo).getByLabelText(/pin inicial/i), { target: { value: '482913' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /agregar vendedor/i }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('Lucía')).toBeTruthy())
    expect(llamadas).toContainEqual({ accion: 'vendedor', negocioId: 'neg-1', operacion: 'agregar', nombre: 'Lucía', telefono: '261 555 1111', pin: '482913' })
    expect(within(screen.getByRole('dialog')).getByText('482913')).toBeTruthy()
  })

  it('pide confirmación antes de quitar y después lo saca de la lista', async () => {
    vendedores = [{ usuarioId: 'u-9', nombre: 'Pedro', telefono: '5492615559999', creadoEn: '2026-10-20T00:00:00Z' }]
    const dialogo = await abrirVendedores()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^quitar$/i }))
    expect(llamadas.some((l) => l.accion === 'vendedor')).toBe(false)
    fireEvent.click(within(dialogo).getByRole('button', { name: /sí, quitar/i }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).queryByText('Pedro')).toBeNull())
    expect(llamadas).toContainEqual({ accion: 'vendedor', negocioId: 'neg-1', operacion: 'quitar', usuarioId: 'u-9' })
  })

  it('cambia el PIN de un vendedor', async () => {
    vendedores = [{ usuarioId: 'u-9', nombre: 'Pedro', telefono: '5492615559999', creadoEn: '2026-10-20T00:00:00Z' }]
    const dialogo = await abrirVendedores()

    fireEvent.click(within(dialogo).getByRole('button', { name: /nuevo pin/i }))
    fireEvent.change(within(dialogo).getByLabelText(/pin nuevo/i), { target: { value: '739184' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar pin/i }))

    await waitFor(() => expect(llamadas).toContainEqual({ accion: 'vendedor', negocioId: 'neg-1', operacion: 'pin', usuarioId: 'u-9', pin: '739184' }))
  })
})
