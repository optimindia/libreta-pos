import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaVender } from '@/ui/vender/PantallaVender'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.productos.guardar({
    codigoBarras: '779', nombre: 'Yerba Playadito',
    costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
  })
})

async function cargarProductos(cantidad: number) {
  for (let i = 0; i < cantidad; i++) {
    await repos.productos.guardar({
      codigoBarras: null, nombre: `Producto ${i}`,
      costo: 1000, precio: 2000, stock: 5, stockMinimo: 1,
    })
  }
}

describe('PantallaVender', () => {
  it('empieza con el ticket vacío y el total en cero', async () => {
    render(<PantallaVender />)
    expect(await screen.findByText('$0')).toBeDefined()
  })

  it('agregar un producto lo muestra en el ticket y suma al total', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    await waitFor(() => expect(screen.getAllByText('$4.200').length).toBeGreaterThan(0))
  })

  it('cobrar registra la venta y vacía el ticket', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '5000' } })
    fireEvent.click(await screen.findByRole('button', { name: /cobrar \$4\.200/i }))
    await waitFor(async () => expect(await repos.ventas.todas()).toHaveLength(1))
  })

  it('exige confirmar una transferencia y permite guardar su referencia', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /transferencia/i }))
    const registrar = await screen.findByRole('button', { name: /registrar venta confirmada/i })
    expect(registrar).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText(/referencia del pago/i), { target: { value: '8472' } })
    fireEvent.click(screen.getByLabelText(/ya vi el pago aprobado/i))
    expect(registrar).toHaveProperty('disabled', false)
    fireEvent.click(registrar)
    await waitFor(async () => expect((await repos.ventas.todas())[0].referenciaPago).toBe('8472'))
  })

  it('al elegir fiado crea el cliente y registra la deuda', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^fiado$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre del cliente'), { target: { value: 'Marta' } })
    fireEvent.click(screen.getByRole('button', { name: /anotar fiado/i }))

    await waitFor(async () => {
      expect(await repos.ventas.todas()).toHaveLength(1)
      expect(await repos.fiados.abiertos()).toHaveLength(1)
    })
    expect((await repos.clientes.todos())[0].nombre).toBe('Marta')
  })

  it('al pagar en efectivo calcula el vuelto antes de confirmar', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '5000' } })
    expect(await screen.findByText('$800')).toBeDefined()
  })

  it('si el pago no alcanza, no deja cobrar y avisa cuánto falta', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '3000' } })
    expect(await screen.findByText(/le faltan \$1\.200/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /cobrar \$4\.200/i })).toHaveProperty('disabled', true)
  })

  it('no deja cobrar un ticket vacío', async () => {
    render(<PantallaVender />)
    const boton = await screen.findByRole('button', { name: /^cobrar$/i })
    expect(boton).toHaveProperty('disabled', true)
  })

  it('el catálogo muestra el precio de cada producto', async () => {
    render(<PantallaVender />)
    expect(await screen.findByText('Yerba Playadito')).toBeDefined()
    expect(screen.getByText('$4.200')).toBeDefined()
  })

  it('muestra el buscador desde el primer producto', async () => {
    render(<PantallaVender />)
    await screen.findByText('Yerba Playadito')
    expect(screen.getByLabelText('Buscar producto')).toBeDefined()
  })

  it('no permite agregar un producto agotado al ticket', async () => {
    await repos.productos.guardar({ codigoBarras: '000', nombre: 'Agotado', costo: 100, precio: 200, stock: 0, stockMinimo: 1 })
    render(<PantallaVender />)
    const agotado = await screen.findByRole('button', { name: /sin stock · no vendible/i })
    expect(agotado).toHaveProperty('disabled', true)
  })

  it('con muchos productos aparece el buscador y filtra', async () => {
    await cargarProductos(8)
    render(<PantallaVender />)
    const buscador = await screen.findByLabelText('Buscar producto')
    fireEvent.change(buscador, { target: { value: 'Yerba' } })
    expect(await screen.findByText('Yerba Playadito')).toBeDefined()
    expect(screen.queryByText('Producto 0')).toBeNull()
  })
})
