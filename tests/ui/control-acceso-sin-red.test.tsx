import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EstadoAcceso } from '@/datos/nube/acceso'

let estado: EstadoAcceso
vi.mock('next/navigation', () => ({ usePathname: () => '/vender' }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => true }))
vi.mock('@/ui/sistema/Navegacion', () => ({ Navegacion: () => null }))
vi.mock('@/datos/nube/acceso', () => ({
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => true,
  cargarEstadoAcceso: () => Promise.resolve(estado),
}))

import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

function sinSenal(verificadoEn: number | undefined): EstadoAcceso {
  const ahora = Date.now()
  return {
    autenticado: true, usuarioId: 'u', online: false, verificadoRemoto: false, motivoVerificacion: 'sin_red',
    negocio: { id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n', usuarioId: 'u', verificadoEn },
    suscripcion: { id: 's', negocioId: 'n', estado: 'activa', tipo: 'mensual', inicioEn: ahora - 86_400_000, venceEn: ahora + 10 * 86_400_000 },
  }
}

describe('ControlAcceso sin señal en producción', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('deja seguir vendiendo si el acceso se confirmó hace poco', async () => {
    estado = sinSenal(Date.now() - 3_600_000)
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    expect(await screen.findByText('caja abierta')).toBeTruthy()
  })

  it('bloquea si hace días que no se pudo confirmar', async () => {
    estado = sinSenal(Date.now() - 10 * 86_400_000)
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('caja abierta')).toBeNull()
  })
})
