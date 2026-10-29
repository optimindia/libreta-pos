import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EstadoAcceso } from '@/datos/nube/acceso'

let estado: EstadoAcceso
const cargarEstadoAcceso = vi.fn(() => Promise.resolve(estado))
vi.mock('next/navigation', () => ({ usePathname: () => '/vender' }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => true }))
vi.mock('@/ui/sistema/Navegacion', () => ({ Navegacion: () => null }))
vi.mock('@/datos/nube/acceso', () => ({
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => true,
  cargarEstadoAcceso: () => cargarEstadoAcceso(),
}))

import { ControlAcceso } from '@/ui/sistema/ControlAcceso'

const DIA = 86_400_000

function verificada(diasHastaElVencimiento: number): EstadoAcceso {
  const ahora = Date.now()
  return {
    autenticado: true, usuarioId: 'u', online: true, verificadoRemoto: true,
    negocio: { id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n', usuarioId: 'u', verificadoEn: ahora },
    suscripcion: { id: 's', negocioId: 'n', estado: 'activa', tipo: 'mensual', inicioEn: ahora - DIA, venceEn: ahora + diasHastaElVencimiento * DIA },
  }
}

describe('ControlAcceso con el vencimiento lejos', () => {
  beforeEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); cargarEstadoAcceso.mockClear() })

  it('una suscripción mensual (30 días) no programa un timer que desborda y la bloquea al abrir', async () => {
    // setTimeout admite como máximo 2^31-1 ms (~24,8 días): con 30 días el
    // navegador lo dispara enseguida y el aviso de vencimiento bloqueaba una
    // cuenta vigente (sin red, hasta que volviera la señal).
    const demoras: number[] = []
    const original = window.setTimeout.bind(window)
    vi.spyOn(window, 'setTimeout').mockImplementation(((manejador: TimerHandler, demora?: number, ...resto: unknown[]) => {
      if (typeof demora === 'number') demoras.push(demora)
      return original(manejador, demora, ...resto)
    }) as typeof window.setTimeout)

    estado = verificada(30)
    render(<ControlAcceso><p>caja abierta</p></ControlAcceso>)
    expect(await screen.findByText('caja abierta')).toBeTruthy()
    await new Promise((r) => original(r, 100))

    expect(Math.max(...demoras)).toBeLessThanOrEqual(2_147_483_647)
    expect(screen.queryByText('caja abierta')).not.toBeNull()
  })
})
