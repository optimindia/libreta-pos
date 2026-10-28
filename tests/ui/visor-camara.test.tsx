import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

let alDetectar: ((codigo: string) => void) | null = null
const detener = vi.fn()
vi.mock('@/ui/vender/escaner', () => ({
  escanear: vi.fn(async (_video: HTMLVideoElement, alLeer: (codigo: string) => void) => {
    alDetectar = alLeer
    return Object.assign(detener, { hayLinterna: false })
  }),
}))
vi.mock('@/ui/escaner/sonido', () => ({ avisarLectura: vi.fn() }))

import { VisorCamara } from '@/ui/escaner/VisorCamara'
import { avisarLectura } from '@/ui/escaner/sonido'

beforeEach(() => {
  alDetectar = null
  detener.mockClear()
  vi.mocked(avisarLectura).mockClear()
})

async function abierto(props: Partial<React.ComponentProps<typeof VisorCamara>> = {}) {
  const onCerrar = vi.fn()
  const alLeer = vi.fn(async (codigo: string) => ({ tipo: 'ok' as const, texto: `✓ leído ${codigo}` }))
  render(<VisorCamara titulo="Escaneá" ayuda="Apuntá al código" onCerrar={onCerrar} alLeer={alLeer} {...props} />)
  await waitFor(() => expect(alDetectar).not.toBeNull())
  return { onCerrar, alLeer }
}

describe('VisorCamara', () => {
  it('muestra la ayuda al abrir y se puede cerrar', async () => {
    const { onCerrar } = await abierto()
    expect(screen.getByRole('status').textContent).toBe('Apuntá al código')
    fireEvent.click(screen.getByRole('button', { name: /cerrar escáner/i }))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('en modo continuo suma lecturas, suena y se queda abierto', async () => {
    const { onCerrar, alLeer } = await abierto({ continuo: true, textoListo: 'Ver la venta' })
    await act(async () => { alDetectar?.('7790001') })
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ leído 7790001'))
    expect(avisarLectura).toHaveBeenCalledWith('ok')
    await act(async () => { alDetectar?.('7790002') })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver la venta · 2 productos' })).toBeTruthy())
    expect(alLeer).toHaveBeenCalledTimes(2)
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('ignora el mismo código repetido por la cámara en un instante', async () => {
    const { alLeer } = await abierto({ continuo: true })
    await act(async () => { alDetectar?.('7790001'); alDetectar?.('7790001') })
    await act(async () => { alDetectar?.('7790001') })
    expect(alLeer).toHaveBeenCalledTimes(1)
  })

  it('un código que no se conoce avisa distinto y no cuenta como leído', async () => {
    await abierto({ continuo: true, alLeer: async () => ({ tipo: 'falta', texto: 'No está cargado' }) })
    await act(async () => { alDetectar?.('123456') })
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No está cargado'))
    expect(avisarLectura).toHaveBeenCalledWith('falta')
    expect(screen.getByRole('button', { name: 'Listo' })).toBeTruthy()
  })

  it('sin modo continuo se cierra con la primera lectura buena', async () => {
    const { onCerrar } = await abierto()
    await act(async () => { alDetectar?.('7790001') })
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(detener).toHaveBeenCalled()
  })

  it('el código escrito a mano también se lee', async () => {
    const { alLeer } = await abierto({ continuo: true })
    fireEvent.change(screen.getByLabelText(/código de barras a mano/i), { target: { value: ' 7790 003 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(alLeer).toHaveBeenCalledWith('7790003'))
  })
})
