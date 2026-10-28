import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null }))
vi.mock('@/datos/nube/acceso', () => ({
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => true,
  // Responde al instante, como cuando todo sale de este aparato (sin red).
  cargarEstadoAcceso: () => Promise.resolve({
    autenticado: false, usuarioId: null, negocio: null, suscripcion: null, online: false, verificadoRemoto: false,
  }),
}))

import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

describe('ControlAcceso', () => {
  it('una respuesta instantánea no deja la pantalla trabada en "Preparando tu acceso"', async () => {
    render(<ControlAcceso><p>caja</p></ControlAcceso>)

    expect(await screen.findByRole('button', { name: /entrar a mi negocio/i }, { timeout: 1500 })).toBeTruthy()
    expect(screen.queryByText(/preparando tu acceso/i)).toBeNull()
  })
})
