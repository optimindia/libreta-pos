import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { RegistrarSW } from '@/ui/sistema/RegistrarSW'

const original = Object.getOwnPropertyDescriptor(navigator, 'storage')
afterEach(() => { if (original) Object.defineProperty(navigator, 'storage', original); else delete (navigator as { storage?: unknown }).storage })

describe('RegistrarSW', () => {
  it('pide almacenamiento persistente para que el navegador no borre ventas sin subir', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: vi.fn().mockResolvedValue(false), persist } })
    render(<RegistrarSW />)
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
  })

  it('no lo vuelve a pedir si ya es persistente', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const persisted = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted, persist } })
    render(<RegistrarSW />)
    await waitFor(() => expect(persisted).toHaveBeenCalled())
    expect(persist).not.toHaveBeenCalled()
  })
})
