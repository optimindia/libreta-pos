import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach } from 'vitest'
import { violacionesAxe } from './axe'

const pin = vi.hoisted(() => ({
  consultarEstadoPin: vi.fn(),
  restablecerPinVendedor: vi.fn(),
  generarCodigoRecuperacion: vi.fn(),
  cambiarMiPin: vi.fn(),
  recuperarConCodigo: vi.fn(),
  debeCambiarPin: vi.fn(),
}))

vi.mock('@/datos/nube/pin', () => pin)
vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => false }))

import { CambiarPin } from '@/ui/pin/CambiarPin'
import { RecuperarPin } from '@/ui/pin/RecuperarPin'
import { SeguridadPin } from '@/ui/pin/SeguridadPin'
import { PantallaAcceso } from '@/ui/sistema/PantallaAcceso'

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function escribir(etiqueta: RegExp | string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

describe('Acceso: Me olvidé el PIN', () => {
  it('el enlace abre la recuperación y se puede volver a ingresar', () => {
    render(<PantallaAcceso />)
    fireEvent.click(screen.getByRole('button', { name: /me olvidé el pin/i }))
    expect(screen.getByRole('heading', { name: /recuperá tu pin/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /volver a ingresar/i }))
    expect(screen.getByRole('button', { name: /entrar a mi negocio/i })).toBeTruthy()
  })

  it('el panel de administración no ofrece recuperación por código', () => {
    render(<PantallaAcceso modo="admin" />)
    expect(screen.queryByRole('button', { name: /me olvidé el pin/i })).toBeNull()
  })
})

describe('RecuperarPin', () => {
  it('con un código incorrecto muestra el error en una alerta y no pasa de pantalla', async () => {
    pin.recuperarConCodigo.mockResolvedValue({ ok: false, error: 'El teléfono o el código no son correctos.' })
    render(<RecuperarPin onVolver={() => {}} />)
    escribir(/teléfono/i, '2615551234')
    escribir(/código de recuperación/i, 'AAAA-BBBB-CCCC-DDDD')
    escribir(/^PIN nuevo/, '482913')
    escribir(/repetí el pin nuevo/i, '482913')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/no son correctos/)
    expect(screen.queryByText(/código de recuperación nuevo/i)).toBeNull()
  })

  it('no envía si los dos PIN no coinciden', () => {
    render(<RecuperarPin onVolver={() => {}} />)
    escribir(/teléfono/i, '2615551234')
    escribir(/código de recuperación/i, 'AAAA-BBBB-CCCC-DDDD')
    escribir(/^PIN nuevo/, '482913')
    escribir(/repetí el pin nuevo/i, '482914')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/tienen que ser iguales/)
    expect(pin.recuperarConCodigo).not.toHaveBeenCalled()
  })

  it('al recuperar muestra el código nuevo una sola vez', async () => {
    pin.recuperarConCodigo.mockResolvedValue({ ok: true, codigoRecuperacion: 'WXYZ-1234-ABCD-5678' })
    const volver = vi.fn()
    render(<RecuperarPin onVolver={volver} />)
    escribir(/teléfono/i, '2615551234')
    escribir(/código de recuperación/i, 'aaaa-bbbb-cccc-dddd')
    escribir(/^PIN nuevo/, '482913')
    escribir(/repetí el pin nuevo/i, '482913')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))

    expect(await screen.findByText('WXYZ-1234-ABCD-5678')).toBeTruthy()
    expect(pin.recuperarConCodigo).toHaveBeenCalledWith('2615551234', 'AAAA-BBBB-CCCC-DDDD', '482913', undefined)
    fireEvent.click(screen.getByRole('button', { name: /ya lo guardé/i }))
    expect(volver).toHaveBeenCalled()
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(<RecuperarPin onVolver={() => {}} />)
    expect(await violacionesAxe(container)).toEqual([])
  })
})

describe('CambiarPin', () => {
  it('rechaza un PIN nuevo igual al actual sin llamar a la nube', () => {
    render(<CambiarPin actualEtiqueta="PIN temporal" onListo={() => {}} />)
    escribir(/pin temporal/i, '482913')
    escribir(/^PIN nuevo/, '482913')
    escribir(/repetí el pin nuevo/i, '482913')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/distinto/)
    expect(pin.cambiarMiPin).not.toHaveBeenCalled()
  })

  it('un vendedor termina el cambio sin código; el dueño ve su código nuevo', async () => {
    pin.cambiarMiPin.mockResolvedValueOnce({ ok: true })
    const listo = vi.fn()
    const { unmount } = render(<CambiarPin onListo={listo} />)
    escribir(/pin actual/i, '482913')
    escribir(/^PIN nuevo/, '739154')
    escribir(/repetí el pin nuevo/i, '739154')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))
    await waitFor(() => expect(listo).toHaveBeenCalledTimes(1))
    unmount()

    pin.cambiarMiPin.mockResolvedValueOnce({ ok: true, codigoRecuperacion: 'AAAA-1111-BBBB-2222' })
    const listoDueno = vi.fn()
    render(<CambiarPin onListo={listoDueno} />)
    escribir(/pin actual/i, '482913')
    escribir(/^PIN nuevo/, '739154')
    escribir(/repetí el pin nuevo/i, '739154')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))
    expect(await screen.findByText('AAAA-1111-BBBB-2222')).toBeTruthy()
    expect(listoDueno).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /ya lo guardé/i }))
    expect(listoDueno).toHaveBeenCalled()
  })

  it('un PIN actual equivocado se muestra como error', async () => {
    pin.cambiarMiPin.mockResolvedValue({ ok: false, error: 'El PIN actual no es correcto.' })
    render(<CambiarPin onListo={() => {}} />)
    escribir(/pin actual/i, '111112')
    escribir(/^PIN nuevo/, '739154')
    escribir(/repetí el pin nuevo/i, '739154')
    fireEvent.click(screen.getByRole('button', { name: /cambiar mi pin/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es correcto/)
  })
})

describe('SeguridadPin', () => {
  const estadoDueno = {
    ok: true,
    rol: 'dueno',
    debeCambiarPin: false,
    tieneCodigo: false,
    vendedores: [
      { usuarioId: 'v1', nombre: 'Lucía', telefono: '2615550001', pendiente: true },
      { usuarioId: 'v2', nombre: 'Mateo', telefono: '2615550002', pendiente: false },
    ],
  }

  it('si no carga, ofrece Reintentar', async () => {
    pin.consultarEstadoPin.mockResolvedValueOnce({ ok: false, error: 'No se pudo conectar.' })
    render(<SeguridadPin />)
    expect(await screen.findByText(/no se pudo conectar/i)).toBeTruthy()
    pin.consultarEstadoPin.mockResolvedValueOnce(estadoDueno)
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByText('Lucía')).toBeTruthy()
  })

  it('el dueño ve a sus vendedores y quién tiene el cambio pendiente', async () => {
    pin.consultarEstadoPin.mockResolvedValue(estadoDueno)
    const { container } = render(<SeguridadPin />)
    await screen.findByText('Lucía')
    expect(screen.getAllByText('Pendiente de cambio')).toHaveLength(1)
    expect(await violacionesAxe(container)).toEqual([])
  })

  it('restablecer pide confirmación y muestra el PIN temporal una sola vez', async () => {
    pin.consultarEstadoPin.mockResolvedValue(estadoDueno)
    pin.restablecerPinVendedor.mockResolvedValue({ ok: true, pinTemporal: '804217', vendedor: { usuarioId: 'v2', nombre: 'Mateo' } })
    render(<SeguridadPin />)
    await screen.findByText('Mateo')

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer el PIN de Mateo' }))
    expect(pin.restablecerPinVendedor).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /sí, restablecer/i }))

    expect(await screen.findByText('804217')).toBeTruthy()
    expect(pin.restablecerPinVendedor).toHaveBeenCalledWith('v2')
    fireEvent.click(screen.getByRole('button', { name: /ya lo guardé/i }))
    await waitFor(() => expect(screen.queryByText('804217')).toBeNull())
  })

  it('genera el código con el PIN actual y lo muestra una sola vez', async () => {
    pin.consultarEstadoPin.mockResolvedValue({ ...estadoDueno, vendedores: [] })
    pin.generarCodigoRecuperacion.mockResolvedValue({ ok: true, codigoRecuperacion: 'QQQQ-2222-WWWW-3333' })
    render(<SeguridadPin />)
    await screen.findByText(/todavía no generaste un código/i)

    fireEvent.click(screen.getByRole('button', { name: 'Generar código' }))
    escribir(/tu pin actual/i, '482913')
    fireEvent.click(screen.getByRole('button', { name: 'Generar código' }))

    expect(await screen.findByText('QQQQ-2222-WWWW-3333')).toBeTruthy()
    expect(pin.generarCodigoRecuperacion).toHaveBeenCalledWith('482913')
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /ya lo guardé/i }))
    await waitFor(() => expect(screen.queryByText('QQQQ-2222-WWWW-3333')).toBeNull())
  })

  it('el vendedor sólo ve cambiar su PIN: ni código ni lista de vendedores', async () => {
    pin.consultarEstadoPin.mockResolvedValue({ ok: true, rol: 'vendedor', debeCambiarPin: false })
    render(<SeguridadPin />)
    await screen.findByRole('button', { name: /cambiar mi pin/i })
    expect(screen.queryByText(/código de recuperación/i)).toBeNull()
    expect(screen.queryByText(/pin de tus vendedores/i)).toBeNull()
  })
})
