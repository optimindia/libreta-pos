import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaPlata } from '@/ui/plata/PantallaPlata'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaPlata', () => {
  it('muestra lo vendido y lo ganado del día', async () => {
    const producto = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
    })
    await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }],
    })
    render(<PantallaPlata />)
    // El mismo monto aparece en el resumen, el ranking y el medio de pago.
    expect((await screen.findAllByText('$4.200')).length).toBeGreaterThanOrEqual(2)
    expect((await screen.findAllByText('$1.200')).length).toBeGreaterThanOrEqual(1)
  })

  it('sin ventas no rompe: muestra cero', async () => {
    render(<PantallaPlata />)
    expect((await screen.findAllByText('$0')).length).toBeGreaterThan(0)
  })

  it('lista lo que hay que reponer', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Fideos', costo: 80000, precio: 120000, stock: 1, stockMinimo: 5,
    })
    render(<PantallaPlata />)
    expect((await screen.findAllByText(/Fideos/)).length).toBeGreaterThan(0)
  })

  it('cambia el rango y comparte un resumen', async () => {
    render(<PantallaPlata />)
    fireEvent.click(await screen.findByRole('button', { name: '7dias' }))
    expect(await screen.findByText('Últimos 7 días')).toBeDefined()
    const enlace = screen.getByRole('link', { name: /compartir resumen/i }) as HTMLAnchorElement
    expect(decodeURIComponent(enlace.href)).toContain('Resumen de últimos 7 días')
  })
})
