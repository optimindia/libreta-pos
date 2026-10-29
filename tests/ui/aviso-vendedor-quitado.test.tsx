import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EstadoAcceso } from '@/datos/nube/acceso'

vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => true }))
import { PantallaEstadoAcceso } from '@/ui/sistema/PantallaEstadoAcceso'

const base: EstadoAcceso = { autenticado: true, usuarioId: 'u', negocio: null, suscripcion: null, online: true, verificadoRemoto: true }

describe('SEG-05: aviso al vendedor quitado', () => {
  it('explica que lo quitaron del negocio y que se borraron los datos de este aparato', () => {
    render(<PantallaEstadoAcceso estado={{ ...base, motivoSinNegocio: 'vendedor_quitado' }} />)
    expect(screen.getByRole('heading', { name: /ya no tenés acceso a este negocio/i })).toBeTruthy()
    expect(screen.getByText(/borramos los datos de este aparato/i)).toBeTruthy()
    expect(screen.queryByText(/pendiente de activación/i)).toBeNull()
  })

  it('sin motivo de baja mantiene el texto de cuenta pendiente', () => {
    render(<PantallaEstadoAcceso estado={base} />)
    expect(screen.getByText(/pendiente de activación/i)).toBeTruthy()
  })
})
