import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { RegistrarSW } from '@/ui/sistema/RegistrarSW'
import { entornoSW, ventaAbiertaAhora, setVentaAbierta, useMarcarVentaAbierta } from '@/ui/sistema/actualizacionSW'

class FakeSW extends EventTarget {
  state = 'installed'
  postMessage = vi.fn()
}

let registro: EventTarget & { waiting: FakeSW | null; installing: FakeSW | null; update: ReturnType<typeof vi.fn> }
let contenedor: EventTarget & { controller: object | null; register: ReturnType<typeof vi.fn> }
const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')

function montarSW(opciones: { espera: boolean; controlado: boolean }) {
  registro = Object.assign(new EventTarget(), {
    waiting: opciones.espera ? new FakeSW() : null,
    installing: null as FakeSW | null,
    update: vi.fn().mockResolvedValue(undefined),
  })
  contenedor = Object.assign(new EventTarget(), {
    controller: opciones.controlado ? {} : null,
    register: vi.fn().mockResolvedValue(registro),
  })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: contenedor })
}

function visibilidad(valor: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: valor })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  setVentaAbierta(false)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.spyOn(entornoSW, 'recargar').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  if (original) Object.defineProperty(navigator, 'serviceWorker', original)
  else delete (navigator as { serviceWorker?: unknown }).serviceWorker
})

describe('PWA-02: aviso de versión nueva', () => {
  it('muestra "Hay una versión nueva" cuando hay un service worker esperando', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    expect(await screen.findByText(/hay una versión nueva/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeTruthy()
  })

  it('no avisa en la primera instalación (todavía no había versión anterior)', async () => {
    montarSW({ espera: true, controlado: false })
    render(<RegistrarSW />)
    await waitFor(() => expect(contenedor.register).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText(/hay una versión nueva/i)).toBeNull()
  })

  it('detecta una versión que termina de instalarse mientras la app está abierta', async () => {
    montarSW({ espera: false, controlado: true })
    render(<RegistrarSW />)
    await waitFor(() => expect(contenedor.register).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    const nuevo = new FakeSW()
    registro.installing = nuevo
    act(() => { registro.dispatchEvent(new Event('updatefound')); nuevo.dispatchEvent(new Event('statechange')) })
    expect(await screen.findByText(/hay una versión nueva/i)).toBeTruthy()
  })

  it('al tocar Actualizar activa la versión nueva y recarga cuando el navegador cambia de worker', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    fireEvent.click(await screen.findByRole('button', { name: /actualizar/i }))
    expect(registro.waiting?.postMessage).toHaveBeenCalledWith({ tipo: 'SKIP_WAITING' })
    expect(entornoSW.recargar).not.toHaveBeenCalled()
    act(() => { contenedor.dispatchEvent(new Event('controllerchange')) })
    expect(entornoSW.recargar).toHaveBeenCalledTimes(1)
  })

  it('no recarga si el cambio de worker no lo pidió esta pantalla', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    await screen.findByText(/hay una versión nueva/i)
    act(() => { contenedor.dispatchEvent(new Event('controllerchange')) })
    expect(entornoSW.recargar).not.toHaveBeenCalled()
  })

  it('con una venta abierta, tocar Actualizar espera: no activa ni recarga en medio de la venta', async () => {
    montarSW({ espera: true, controlado: true })
    setVentaAbierta(true)
    render(<RegistrarSW />)
    fireEvent.click(await screen.findByRole('button', { name: /actualizar/i }))
    expect(registro.waiting?.postMessage).not.toHaveBeenCalled()
    expect(screen.getByText(/al terminar la venta/i)).toBeTruthy()
    act(() => { contenedor.dispatchEvent(new Event('controllerchange')) })
    expect(entornoSW.recargar).not.toHaveBeenCalled()
  })

  it('al cerrarse la venta, la actualización pedida se aplica sola', async () => {
    montarSW({ espera: true, controlado: true })
    setVentaAbierta(true)
    render(<RegistrarSW />)
    fireEvent.click(await screen.findByRole('button', { name: /actualizar/i }))
    act(() => setVentaAbierta(false))
    expect(registro.waiting?.postMessage).toHaveBeenCalledWith({ tipo: 'SKIP_WAITING' })
    act(() => { contenedor.dispatchEvent(new Event('controllerchange')) })
    expect(entornoSW.recargar).toHaveBeenCalledTimes(1)
  })

  it('sin venta abierta y con la app en segundo plano, se activa sola sin molestar', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    await screen.findByText(/hay una versión nueva/i)
    act(() => visibilidad('hidden'))
    expect(registro.waiting?.postMessage).toHaveBeenCalledWith({ tipo: 'SKIP_WAITING' })
  })

  it('con venta abierta nunca se activa sola, ni en segundo plano', async () => {
    montarSW({ espera: true, controlado: true })
    setVentaAbierta(true)
    render(<RegistrarSW />)
    await screen.findByText(/hay una versión nueva/i)
    act(() => visibilidad('hidden'))
    expect(registro.waiting?.postMessage).not.toHaveBeenCalled()
  })
})

describe('PWA-02: Actualizar no puede quedar muerto', () => {
  it('si la versión que esperaba ya se activó o quedó obsoleta, Actualizar recarga igual', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    const boton = await screen.findByRole('button', { name: /actualizar/i })
    registro.waiting!.state = 'redundant'
    fireEvent.click(boton)
    expect(entornoSW.recargar).toHaveBeenCalledTimes(1)
  })

  it('si el navegador nunca avisa el cambio de worker, recarga a los pocos segundos', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    const boton = await screen.findByRole('button', { name: /actualizar/i })
    vi.useFakeTimers()
    try {
      fireEvent.click(boton)
      expect(registro.waiting?.postMessage).toHaveBeenCalledWith({ tipo: 'SKIP_WAITING' })
      expect(entornoSW.recargar).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(3500) })
      expect(entornoSW.recargar).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('si el cambio de worker llega a tiempo, no recarga dos veces', async () => {
    montarSW({ espera: true, controlado: true })
    render(<RegistrarSW />)
    const boton = await screen.findByRole('button', { name: /actualizar/i })
    vi.useFakeTimers()
    try {
      fireEvent.click(boton)
      act(() => { contenedor.dispatchEvent(new Event('controllerchange')) })
      act(() => { vi.advanceTimersByTime(5000) })
      expect(entornoSW.recargar).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useMarcarVentaAbierta', () => {
  function Probe({ abierta }: { abierta: boolean }) {
    useMarcarVentaAbierta(abierta)
    return null
  }

  it('marca la venta como abierta mientras el componente lo pide y la suelta al desmontar', () => {
    const { rerender, unmount } = render(<Probe abierta />)
    expect(ventaAbiertaAhora()).toBe(true)
    rerender(<Probe abierta={false} />)
    expect(ventaAbiertaAhora()).toBe(false)
    rerender(<Probe abierta />)
    unmount()
    expect(ventaAbiertaAhora()).toBe(false)
  })
})
