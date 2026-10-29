import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const estado = vi.hoisted(() => ({ debe: false, falla: false }))
const cambiarMiPin = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname: () => '/vender' }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null }))
vi.mock('@/datos/nube/sesion', () => ({ cerrarSesion: vi.fn(async () => {}) }))
vi.mock('@/datos/nube/pin', () => ({
  debeCambiarPin: async () => {
    if (estado.falla) throw new Error('sin migración')
    return estado.debe
  },
  cambiarMiPin: (...args: unknown[]) => cambiarMiPin(...args),
}))
vi.mock('@/datos/nube/acceso', () => ({
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => true,
  notificarCambioAcceso: () => window.dispatchEvent(new Event('libreta-acceso')),
  cargarEstadoAcceso: () => Promise.resolve({
    autenticado: true,
    usuarioId: 'u1',
    negocio: { id: 'n1', nombre: 'Kiosco', verificadoEn: Date.now() },
    suscripcion: { estado: 'activa', venceEn: Date.now() + 10 * 86_400_000 },
    online: true,
    verificadoRemoto: true,
  }),
}))
vi.mock('@/ui/sistema/Navegacion', () => ({ Navegacion: () => null }))
vi.mock('@/ui/sistema/GuardiaFuncion', () => ({ GuardiaFuncion: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

afterEach(cleanup)
beforeEach(() => {
  estado.debe = false
  estado.falla = false
  cambiarMiPin.mockReset()
})

describe('ControlAcceso: PIN temporal', () => {
  it('con un PIN temporal tapa la caja y pide elegir uno propio', async () => {
    estado.debe = true
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)

    expect(await screen.findByRole('heading', { name: /elegí tu pin propio/i })).toBeTruthy()
    expect(screen.queryByText('caja abierta')).toBeNull()
  })

  it('al cambiarlo se abre la caja', async () => {
    estado.debe = true
    cambiarMiPin.mockResolvedValue({ ok: true })
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    await screen.findByRole('heading', { name: /elegí tu pin propio/i })

    fireEvent.change(screen.getByLabelText(/pin temporal/i), { target: { value: '804217' } })
    fireEvent.change(screen.getByLabelText(/^PIN nuevo/), { target: { value: '739154' } })
    fireEvent.change(screen.getByLabelText(/repetí el pin nuevo/i), { target: { value: '739154' } })
    estado.debe = false
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))

    await waitFor(() => expect(screen.getByText('caja abierta')).toBeTruthy())
    expect(cambiarMiPin).toHaveBeenCalledWith('804217', '739154')
  })

  it('con un PIN normal no se interpone', async () => {
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    expect(await screen.findByText('caja abierta')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /elegí tu pin propio/i })).toBeNull()
  })

  it('si no se puede averiguar (sin migración o sin red) nadie queda afuera', async () => {
    estado.falla = true
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    expect(await screen.findByText('caja abierta')).toBeTruthy()
  })
})
