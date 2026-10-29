import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import type { Venta } from '@/dominio/tipos'
import { Cobrado } from '@/ui/vender/Cobrado'
import { PantallaHistorial } from '@/ui/historial/PantallaHistorial'
import { PantallaConfig } from '@/ui/config/PantallaConfig'
import { BotonesTicket } from '@/ui/ticket/BotonesTicket'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const FECHA = Date.UTC(2026, 9, 29, 17, 5)
const NEGOCIO = { id: 'unico', nombre: 'Almacén Rosales', logo: null, color: null }
const VENTA: Venta = {
  id: 'v1', fecha: FECHA, total: 840000, medioPago: 'efectivo', clienteId: null, estado: 'completada',
  items: [{ productoId: 'a', nombre: 'Yerba Playadito', cantidad: 2, precio: 420000, costo: 300000 }],
}

async function ticketMontado(): Promise<HTMLElement> {
  return waitFor(() => {
    const nodo = document.querySelector<HTMLElement>('.f-ticket-impreso')
    expect(nodo).not.toBeNull()
    return nodo as HTMLElement
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.print = vi.fn()
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'share')
})

describe('Botón "Imprimir ticket"', () => {
  it('aparece tras cobrar y al tocarlo monta el ticket e imprime', async () => {
    render(<Cobrado venta={VENTA} negocio={NEGOCIO} pagoCon={1000000} onNueva={() => {}} />)
    const boton = await screen.findByRole('button', { name: 'Imprimir ticket' })
    expect(boton.getAttribute('data-variante')).toBe('secundario')
    expect(document.querySelector('.f-ticket-impreso')).toBeNull()

    fireEvent.click(boton)

    const ticket = await ticketMontado()
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(ticket.parentElement).toBe(document.body)
    const t = within(ticket)
    expect(t.getByText('Almacén Rosales')).toBeTruthy()
    expect(t.getByText('29/10/2026 14:05')).toBeTruthy()
    expect(t.getByText('Yerba Playadito')).toBeTruthy()
    expect(t.getByText('2 x')).toBeTruthy()
    expect(t.getAllByText('$8.400').length).toBe(2) // renglón y total
    expect(t.getByText('Efectivo')).toBeTruthy()
    expect(t.getByText('$1.600')).toBeTruthy() // vuelto
    expect(t.getByText('Gracias por tu compra')).toBeTruthy()
    expect(ticket.querySelector('style')?.textContent).toContain('size: 58mm auto')
  })

  it('el ticket sigue el ancho y la leyenda elegidos en Config', async () => {
    window.localStorage.setItem('libreta-ticket', JSON.stringify({ ancho: 80, leyenda: 'Vuelva pronto' }))
    render(<BotonesTicket datos={{ negocio: 'Kiosco', venta: VENTA }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ticket' }))
    const ticket = await ticketMontado()
    expect(ticket.getAttribute('data-ancho')).toBe('80')
    expect(ticket.querySelector('style')?.textContent).toContain('size: 80mm auto')
    expect(within(ticket).getByText('Vuelva pronto')).toBeTruthy()
    expect(within(ticket).queryByText('Gracias por tu compra')).toBeNull()
  })

  it('aparece en el detalle de la venta del Historial, con el vendedor si existe', async () => {
    await db.negocio.put({ ...NEGOCIO, negocioId: 'n', usuarioId: 'u1', rol: 'dueno', nombreUsuario: 'Marta' })
    await db.ventas.put({ ...VENTA, fecha: Date.now() - 60_000, vendidoPor: 'u1' })
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByRole('button', { name: /Ver venta de/ }))
    const hoja = await screen.findByRole('dialog', { name: 'Detalle de venta' })
    fireEvent.click(await within(hoja).findByRole('button', { name: 'Imprimir ticket' }))
    const ticket = await ticketMontado()
    expect(within(ticket).getByText('Marta')).toBeTruthy()
    expect(window.print).toHaveBeenCalled()
  })
})

describe('Botón "Compartir"', () => {
  it('no se muestra si el aparato no sabe compartir', () => {
    render(<BotonesTicket datos={{ negocio: 'Kiosco', venta: VENTA }} />)
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull()
  })

  it('comparte el ticket como texto plano', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<BotonesTicket datos={{ negocio: 'Kiosco', venta: VENTA, pagoCon: 1000000 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const { text } = share.mock.calls[0][0] as { text: string }
    expect(text).toContain('Kiosco')
    expect(text).toContain('2 x Yerba Playadito')
    expect(text).toContain('$1.600')
    expect(text).toContain('Gracias por tu compra')
    expect(text).not.toContain('<')
  })

  it('si cancelan la hoja de compartir no muestra error', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<BotonesTicket datos={{ negocio: 'Kiosco', venta: VENTA }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Config: ticket impreso', () => {
  it('guarda el ancho del papel y la leyenda en las preferencias locales', async () => {
    render(<PantallaConfig />)
    fireEvent.click(await screen.findByRole('radio', { name: /80 milímetros/ }))
    fireEvent.change(screen.getByLabelText('Frase al pie del ticket'), { target: { value: 'Vuelva pronto' } })
    expect(JSON.parse(window.localStorage.getItem('libreta-ticket') ?? '{}')).toEqual({ ancho: 80, leyenda: 'Vuelva pronto' })
  })

  it('por defecto muestra 58 mm y "Gracias por tu compra"', async () => {
    render(<PantallaConfig />)
    expect((await screen.findByRole('radio', { name: /58 milímetros/ })).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Frase al pie del ticket') as HTMLInputElement).value).toBe('Gracias por tu compra')
  })
})
