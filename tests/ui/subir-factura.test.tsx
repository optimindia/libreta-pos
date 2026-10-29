import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'

vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => false }))
import { SubirFactura } from '@/ui/stock/SubirFactura'

const fetchOriginal = globalThis.fetch

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => { globalThis.fetch = fetchOriginal })

const CONFIRMAR = /sumar al stock|confirmar/i

async function leerFactura(items: Array<{ nombre: string; cantidad: number; costoUnitario: number }>) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ items }), { status: 200 })) as unknown as typeof fetch
  render(<SubirFactura />)
  const foto = new File(['x'], 'factura.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Foto de la factura'), { target: { files: [foto] } })
  await screen.findByLabelText(`Costo de ${items[0].nombre.trim()}`)
}

describe('SubirFactura: costos y productos repetidos (FUN-13)', () => {
  it('el costo se puede escribir con coma decimal sin que el campo lo borre', async () => {
    await leerFactura([{ nombre: 'Yerba', cantidad: 2, costoUnitario: 100000 }])
    const costo = screen.getByLabelText('Costo de Yerba') as HTMLInputElement
    fireEvent.change(costo, { target: { value: '12,' } })
    expect(costo.value).toBe('12,')
    fireEvent.change(costo, { target: { value: '12,5' } })
    expect(costo.value).toBe('12,5')
  })

  it('un costo escrito como "1.250,50" se guarda como $1.250,50 y no como $0', async () => {
    await leerFactura([{ nombre: 'Yerba', cantidad: 2, costoUnitario: 100000 }])
    fireEvent.change(screen.getByLabelText('Costo de Yerba'), { target: { value: '1.250,50' } })
    fireEvent.click(screen.getByRole('button', { name: CONFIRMAR }))
    await waitFor(async () => expect(await repos.ingresos.todos()).toHaveLength(1))
    expect((await repos.ingresos.todos())[0].items[0].costoUnitario).toBe(125050)
  })

  it('no duplica un producto que ya existe con otro acento o mayúsculas', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Azúcar Ledesma', costo: 50000, precio: 90000, stock: 1, stockMinimo: 1 })
    await leerFactura([{ nombre: 'AZUCAR LEDESMA ', cantidad: 3, costoUnitario: 60000 }])
    fireEvent.click(screen.getByRole('button', { name: CONFIRMAR }))
    await waitFor(async () => expect(await repos.ingresos.todos()).toHaveLength(1))
    const productos = await repos.productos.todos()
    expect(productos).toHaveLength(1)
    expect(productos[0].stock).toBe(4)
  })

  it('dos renglones del mismo producto nuevo crean un solo producto', async () => {
    await leerFactura([
      { nombre: 'Fideos Matarazzo', cantidad: 2, costoUnitario: 80000 },
      { nombre: 'fideos matarazzo', cantidad: 3, costoUnitario: 80000 },
    ])
    fireEvent.click(screen.getByRole('button', { name: CONFIRMAR }))
    await waitFor(async () => expect(await repos.ingresos.todos()).toHaveLength(1))
    const productos = await repos.productos.todos()
    expect(productos).toHaveLength(1)
    expect(productos[0].stock).toBe(5)
  })
})
