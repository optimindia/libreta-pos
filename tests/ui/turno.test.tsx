import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { PantallaHistorial } from '@/ui/historial/PantallaHistorial'
import { PantallaPlata } from '@/ui/plata/PantallaPlata'
import type { Venta, Cierre } from '@/dominio/tipos'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const AHORA = Date.now()
const V1 = 'vend-aaaa1111'
const V2 = 'vend-bbbb2222'

const venta = (id: string, nombre: string, total: number, extra: Partial<Venta> = {}): Venta => ({
  id, fecha: AHORA - 60_000, total, medioPago: 'efectivo', clienteId: null, estado: 'completada',
  items: [{ productoId: id, nombre, cantidad: 1, precio: total, costo: Math.round(total / 2) }],
  ...extra,
})

async function sembrar() {
  await db.ventas.bulkPut([
    venta('a', 'Yerba', 100000, { vendidoPor: V1 }),
    venta('b', 'Fideos', 200000, { vendidoPor: V2 }),
    venta('c', 'Galletitas', 50000), // venta vieja, sin dato
  ])
}
const comoDueno = () => db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n', usuarioId: 'u-dueno', rol: 'dueno' })
const comoVendedor = (usuarioId = V1) => db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n', usuarioId, rol: 'vendedor', nombreUsuario: 'Lucía' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Historial: filtro por vendedor', () => {
  it('el dueño filtra por vendedor y por "Sin dato"', async () => {
    await comoDueno()
    await sembrar()
    render(<PantallaHistorial />)
    const filtro = await screen.findByRole('group', { name: 'Vendedor' })
    expect(await screen.findByText(/Galletitas/)).toBeTruthy()
    expect(screen.getByText(/Yerba/)).toBeTruthy()

    fireEvent.click(within(filtro).getByRole('button', { name: 'Sin dato' }))
    await waitFor(() => expect(screen.queryByText(/Yerba/)).toBeNull())
    expect(screen.getByText(/Galletitas/)).toBeTruthy()

    fireEvent.click(within(filtro).getByRole('button', { name: 'Vendedor 1111' }))
    await waitFor(() => expect(screen.queryByText(/Galletitas/)).toBeNull())
    expect(screen.getByText(/Yerba/)).toBeTruthy()
    expect(screen.queryByText(/Fideos/)).toBeNull()

    fireEvent.click(within(filtro).getByRole('button', { name: 'Todos' }))
    expect(await screen.findByText(/Fideos/)).toBeTruthy()
  })

  it('el detalle de una venta vieja dice "Sin dato"', async () => {
    await comoDueno()
    await sembrar()
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByRole('button', { name: /Ver venta de \$\s?500/ }))
    const hoja = await screen.findByRole('dialog', { name: 'Detalle de venta' })
    expect(within(hoja).getByText(/Vendió/)).toBeTruthy()
    expect(within(hoja).getByText(/Sin dato/)).toBeTruthy()
  })

  it('el vendedor ve sólo lo suyo y no tiene el filtro', async () => {
    await comoVendedor()
    await sembrar()
    render(<PantallaHistorial />)
    expect(await screen.findByText(/Yerba/)).toBeTruthy()
    expect(screen.queryByText(/Fideos/)).toBeNull()
    expect(screen.queryByText(/Galletitas/)).toBeNull()
    expect(screen.queryByRole('group', { name: 'Vendedor' })).toBeNull()
  })
})

describe('Cierre de turno del vendedor', () => {
  it('el dueño no ve "Cerrar mi turno" (cierra en Plata)', async () => {
    await comoDueno()
    await sembrar()
    render(<PantallaHistorial />)
    await screen.findByText(/Yerba/)
    expect(screen.queryByRole('button', { name: /cerrar mi turno/i })).toBeNull()
  })

  it('cuenta sólo SU efectivo, no muestra ganancias y guarda el cierre de turno', async () => {
    await comoVendedor()
    await sembrar()
    await db.fiadoPagos.put({ id: 'p1', fiadoId: 'f', monto: 30000, fecha: AHORA - 1000, usuarioId: V1 })
    await db.fiadoPagos.put({ id: 'p2', fiadoId: 'f', monto: 99900, fecha: AHORA - 1000, usuarioId: V2 })
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar mi turno/i }))
    const hoja = await screen.findByRole('dialog', { name: /tu turno/i })

    // 1000 de ventas en efectivo + 300 de pagos de fiado = 1300 esperado.
    expect(within(hoja).getByText('Esperado').closest('div')?.textContent).toContain('$1.300')
    expect(within(hoja).queryByText(/ganancia|costo|margen/i)).toBeNull()
    expect(within(hoja).queryByRole('link')).toBeNull()

    fireEvent.change(within(hoja).getByLabelText(/cuánto contaste/i), { target: { value: '1200' } })
    expect(await within(hoja).findByText(/te faltó/i)).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: /guardar cierre/i }))

    await waitFor(async () => expect(await db.cierres.count()).toBe(1))
    const guardado = (await db.cierres.toArray())[0] as Cierre
    expect(guardado).toMatchObject({ alcance: 'turno', usuarioId: V1, esperado: 130000, contado: 120000, fondoInicial: 0 })
    const enCola = await db.cola.get(`cierre:${guardado.id}`)
    expect(enCola).toBeTruthy()
  })

  it('después de cerrar, el turno siguiente arranca de cero', async () => {
    await comoVendedor()
    await sembrar()
    await db.cierres.put({ id: 'c0', fecha: AHORA - 1000, fondoInicial: 0, ventasEfectivo: 100000, pagosFiadoEfectivo: 0, esperado: 100000, contado: 100000, alcance: 'turno', usuarioId: V1 })
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByRole('button', { name: /cerrar mi turno/i }))
    const hoja = await screen.findByRole('dialog', { name: /tu turno/i })
    expect(within(hoja).getByText('Esperado').closest('div')?.textContent).toContain('$0')
  })
})

describe('Plata: filtro y cierre por vendedor (dueño)', () => {
  it('el filtro por vendedor recalcula lo vendido', async () => {
    await comoDueno()
    await sembrar()
    render(<PantallaPlata />)
    const filtro = await screen.findByRole('group', { name: 'Vendedor' })
    expect((await screen.findAllByText('$3.500')).length).toBeGreaterThan(0)
    fireEvent.click(within(filtro).getByRole('button', { name: 'Vendedor 2222' }))
    await waitFor(() => expect(screen.queryAllByText('$3.500')).toHaveLength(0))
    expect(screen.getAllByText('$2.000').length).toBeGreaterThan(0)
  })

  it('el día se ve vendedor por vendedor con su cierre de turno', async () => {
    await comoDueno()
    await sembrar()
    await db.cierres.put({ id: 'ct', fecha: AHORA - 500, fondoInicial: 0, ventasEfectivo: 100000, pagosFiadoEfectivo: 0, esperado: 100000, contado: 90000, alcance: 'turno', usuarioId: V1 })
    render(<PantallaPlata />)
    const seccion = await screen.findByRole('region', { name: /por vendedor/i })
    const filaV1 = within(seccion).getByText('Vendedor 1111').closest('li') as HTMLElement
    expect(filaV1.textContent).toMatch(/Faltó/)
    expect(filaV1.textContent).toContain('$100')
    expect(within(seccion).getByText('Vendedor 2222').closest('li')?.textContent).toMatch(/Sin cerrar/)
    expect(within(seccion).getByText('Sin dato')).toBeTruthy()
    // El cierre de turno no pisa el cierre del día del dueño.
    expect(screen.getByRole('button', { name: /cerrar caja/i })).toBeTruthy()
  })
})
