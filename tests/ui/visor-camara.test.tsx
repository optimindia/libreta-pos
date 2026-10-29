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

  describe('alta rápida de un código desconocido', () => {
    const desconocido = async (codigo: string) => ({ tipo: 'falta' as const, texto: `El código ${codigo} no está cargado`, codigo })

    it('ofrece cargarlo ahora y suma el producto con lo que se completó', async () => {
      const alCargar = vi.fn(async () => ({ tipo: 'ok' as const, texto: '✓ Cargado y sumado' }))
      await abierto({ continuo: true, alLeer: desconocido, alCargar })
      await act(async () => { alDetectar?.('779052') })
      fireEvent.click(await screen.findByRole('button', { name: /cargarlo ahora/i }))

      fireEvent.change(screen.getByPlaceholderText(/yerba playadito/i), { target: { value: ' Fideos ' } })
      fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: '1500,50' } })
      fireEvent.change(screen.getByLabelText(/cuántas tenés/i), { target: { value: '12' } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y sumar' }))

      await waitFor(() => expect(alCargar).toHaveBeenCalledWith({ codigo: '779052', nombre: 'Fideos', precio: 1500.5, costo: 0, stock: 12 }))
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ Cargado y sumado'))
      expect(screen.getByRole('button', { name: 'Listo · 1 producto' })).toBeTruthy()
    })

    it('entiende "1.500,50" como mil quinientos con cincuenta', async () => {
      const alCargar = vi.fn(async () => ({ tipo: 'ok' as const, texto: '✓ Cargado' }))
      await abierto({ continuo: true, alLeer: desconocido, alCargar })
      await act(async () => { alDetectar?.('779052') })
      fireEvent.click(await screen.findByRole('button', { name: /cargarlo ahora/i }))
      fireEvent.change(screen.getByPlaceholderText(/yerba playadito/i), { target: { value: 'Aceite' } })
      fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: '1.500,50' } })
      fireEvent.change(screen.getByLabelText(/cuántas tenés/i), { target: { value: '2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y sumar' }))
      await waitFor(() => expect(alCargar).toHaveBeenCalledWith(expect.objectContaining({ precio: 1500.5 })))
    })

    it('pide lo que falta antes de guardar', async () => {
      const alCargar = vi.fn()
      await abierto({ continuo: true, alLeer: desconocido, alCargar })
      await act(async () => { alDetectar?.('779052') })
      fireEvent.click(await screen.findByRole('button', { name: /cargarlo ahora/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y sumar' }))
      expect((await screen.findByRole('alert')).textContent).toMatch(/cómo se llama/i)
      expect(alCargar).not.toHaveBeenCalled()
    })

    it('sin permiso para cargar (vendedor) no ofrece el botón', async () => {
      await abierto({ continuo: true, alLeer: desconocido })
      await act(async () => { alDetectar?.('779052') })
      await screen.findByText(/no está cargado/i)
      expect(screen.queryByRole('button', { name: /cargarlo ahora/i })).toBeNull()
    })
  })
})
