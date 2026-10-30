import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaVender } from '@/ui/vender/PantallaVender'
import { violacionesAxe } from './axe'

beforeEach(async () => {
  window.localStorage.clear()
  await db.delete()
  await db.open()
  await repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba Playadito', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3 })
  await repos.productos.guardar({ codigoBarras: null, nombre: 'Pan francés', costo: 50000, precio: 90000, stock: 20, stockMinimo: 3 })
})

async function sumar(nombre: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${nombre}`) }))
}

describe('Ventas abiertas', () => {
  it('lo que lleva la venta no se pierde al salir de Vender y volver', async () => {
    const primera = render(<PantallaVender />)
    await sumar('Yerba Playadito')
    await waitFor(() => expect(screen.getAllByText('$4.200').length).toBeGreaterThan(0))
    await waitFor(async () => expect(await db.ventasAbiertas.count()).toBe(1))
    primera.unmount()

    render(<PantallaVender />)
    await waitFor(() => expect(screen.getAllByText('$4.200').length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: /Quitar uno de Yerba/ })).toBeTruthy()
  })

  it('una venta vacía no se guarda', async () => {
    render(<PantallaVender />)
    await screen.findByRole('button', { name: /^Yerba Playadito/ })
    expect(await db.ventasAbiertas.count()).toBe(0)
  })

  it('"Nueva venta" deja la actual guardada y se puede volver a ella', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
    await sumar('Pan francés')

    const grupo = await screen.findByRole('group', { name: 'Ventas abiertas' })
    expect(within(grupo).getByRole('button', { name: /Venta 1, \$4\.200/ })).toBeTruthy()
    expect(within(grupo).getByRole('button', { name: /Venta 2, \$900/ })).toBeTruthy()
    await waitFor(async () => expect(await db.ventasAbiertas.count()).toBe(2))

    fireEvent.click(within(grupo).getByRole('button', { name: /Venta 1/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Quitar uno de Yerba/ })).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Quitar uno de Pan/ })).toBeNull()
  })

  it('las dos ventas siguen después de recargar y se acuerda de cuál estaba abierta', async () => {
    const primera = render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
    await sumar('Pan francés')
    await waitFor(async () => expect(await db.ventasAbiertas.count()).toBe(2))
    primera.unmount()
    cleanup()

    render(<PantallaVender />)
    expect(await screen.findByRole('button', { name: /Quitar uno de Pan/ })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Ventas abiertas' })).getAllByRole('button')).toHaveLength(3)
  })

  it('cobrar registra solo la venta activa y deja las otras guardadas', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
    await sumar('Pan francés')

    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('radio', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '1000' } })
    fireEvent.click(await screen.findByRole('button', { name: /cobrar \$900/i }))

    await waitFor(async () => expect(await repos.ventas.todas()).toHaveLength(1))
    expect((await repos.ventas.todas())[0].total).toBe(90000)
    await waitFor(async () => expect(await db.ventasAbiertas.count()).toBe(1))
    fireEvent.click(await screen.findByRole('button', { name: /Nueva venta|Venta 1/ }))
  })

  it('el nombre de la venta se ve en la pestaña y queda guardado', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.change(await screen.findByLabelText('Nombre de la venta'), { target: { value: 'Doña Rosa' } })
    expect(await screen.findByRole('button', { name: /Doña Rosa, \$4\.200/ })).toBeTruthy()
    await waitFor(async () => expect((await db.ventasAbiertas.toArray())[0].nombre).toBe('Doña Rosa'))
  })

  it('descartar una venta abierta no toca las demás', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
    await sumar('Pan francés')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar venta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }))
    await waitFor(async () => expect(await db.ventasAbiertas.count()).toBe(1))
    expect(await screen.findByRole('button', { name: /Quitar uno de Yerba/ })).toBeTruthy()
  })

  it('un descuento baja lo que se cobra pero conserva el precio de lista', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Descuento a toda la venta' }))
    fireEvent.change(await screen.findByLabelText('Porcentaje de descuento'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar descuento' }))
    await waitFor(() => expect(screen.getAllByText('$3.780').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: /^cobrar \$3\.780/i }))
    fireEvent.click(await screen.findByRole('radio', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '4000' } })
    fireEvent.click(await screen.findByRole('button', { name: /cobrar \$3\.780/i }))
    await waitFor(async () => expect(await repos.ventas.todas()).toHaveLength(1))
    expect((await repos.ventas.todas())[0].total).toBe(378000)
  })

  it('repetir la última venta carga los mismos productos', async () => {
    const yerba = (await db.productos.toArray()).find((producto) => producto.nombre === 'Yerba Playadito')!
    await repos.ventas.registrar({ items: [{ productoId: yerba.id, nombre: yerba.nombre, cantidad: 2, precio: yerba.precio, costo: yerba.costo }], medioPago: 'efectivo', clienteId: null })
    render(<PantallaVender />)
    await screen.findByRole('button', { name: /^Yerba Playadito/ })
    fireEvent.click(await screen.findByRole('button', { name: 'Repetir la última venta' }))
    await waitFor(() => expect(screen.getAllByText('$8.400').length).toBeGreaterThan(0))
  })

  it('muestra los más vendidos arriba y un toque suma al ticket', async () => {
    const yerba = (await db.productos.toArray()).find((producto) => producto.nombre === 'Yerba Playadito')!
    await repos.ventas.registrar({ items: [{ productoId: yerba.id, nombre: yerba.nombre, cantidad: 3, precio: yerba.precio, costo: yerba.costo }], medioPago: 'efectivo', clienteId: null })
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sumar Yerba Playadito, más vendido' }))
    await waitFor(() => expect(screen.getAllByText('$4.200').length).toBeGreaterThan(0))
  })

  it('sin violaciones de accesibilidad con dos ventas abiertas y el descuento a la vista', async () => {
    render(<PantallaVender />)
    await sumar('Yerba Playadito')
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
    await sumar('Pan francés')
    expect(await violacionesAxe()).toEqual([])
    fireEvent.click(await screen.findByRole('button', { name: 'Descuento a toda la venta' }))
    await screen.findByLabelText('Porcentaje de descuento')
    expect(await violacionesAxe()).toEqual([])
  })

  it('no deja abrir más de 10 ventas', async () => {
    render(<PantallaVender />)
    for (let i = 0; i < 10; i++) {
      if (i > 0) fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }))
      await sumar('Pan francés')
    }
    expect(screen.getByRole('button', { name: 'Nueva venta' })).toHaveProperty('disabled', true)
  })
})
