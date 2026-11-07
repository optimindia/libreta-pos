import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const leer = vi.fn()
vi.mock('@/datos/nube/cuentaCliente', () => ({ leerCuentaCompartida: (token: string) => leer(token) }))
const { PantallaSaldo } = await import('@/ui/saldo/PantallaSaldo')
const { urlDeCuenta } = await vi.importActual<typeof import('@/datos/nube/cuentaCliente')>('@/datos/nube/cuentaCliente')

const TOKEN = 'ab'.repeat(32)

beforeEach(() => { leer.mockReset() })
afterEach(() => { cleanup(); window.location.hash = '' })

describe('la cuenta que ve el cliente', () => {
  it('arma el link con el token después del #', () => {
    expect(urlDeCuenta(TOKEN, 'https://libreta.app/')).toBe(`https://libreta.app/saldo#${TOKEN}`)
  })

  it('muestra el saldo y los movimientos', async () => {
    window.location.hash = TOKEN
    leer.mockResolvedValue({
      negocio: 'Almacén Rosales', cliente: 'Marta Gómez', saldo: 1250000,
      fiados: [{ fecha: '2026-11-05T10:00:00Z', monto: 1250000, items: [{ nombre: 'Yerba', cantidad: 2 }] }],
      pagos: [{ fecha: '2026-11-06T10:00:00Z', monto: 300000 }],
    })
    render(<PantallaSaldo />)
    expect(await screen.findByText('Hola, Marta')).toBeTruthy()
    expect(screen.getByText('$12.500')).toBeTruthy()
    expect(screen.getByText('2 Yerba')).toBeTruthy()
    expect(screen.getByText('Pago')).toBeTruthy()
    expect(leer).toHaveBeenCalledWith(TOKEN)
  })

  it('sin token o con un link cortado lo dice, sin pedir datos', async () => {
    render(<PantallaSaldo />)
    expect(await screen.findByText('Este link ya no funciona')).toBeTruthy()
    expect(leer).not.toHaveBeenCalled()
    cleanup()
    window.location.hash = TOKEN
    leer.mockResolvedValue(null)
    render(<PantallaSaldo />)
    expect(await screen.findByText('Este link ya no funciona')).toBeTruthy()
  })

  it('al día, lo celebra', async () => {
    window.location.hash = TOKEN
    leer.mockResolvedValue({ negocio: 'A', cliente: 'Beto', saldo: 0, fiados: [], pagos: [] })
    render(<PantallaSaldo />)
    expect(await screen.findByText('Estás al día')).toBeTruthy()
  })
})
