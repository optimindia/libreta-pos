import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaInicio } from '@/ui/inicio/PantallaInicio'
import { claveGuia } from '@/ui/inicio/PrimerosPasos'

const producto = { codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3 }

async function cargarProducto() {
  return repos.productos.guardar(producto)
}

async function vender(productoId: string) {
  await repos.ventas.registrar({
    medioPago: 'efectivo', clienteId: null,
    items: [{ productoId, nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }],
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
})

describe('Primeros pasos en Inicio', () => {
  it('en un negocio nuevo muestra la guía con los tres pasos del dueño y 0 de 3', async () => {
    render(<PantallaInicio />)
    const guia = await screen.findByRole('region', { name: 'Primeros pasos' })

    expect(within(guia).getByText('0 de 3 listos')).toBeTruthy()
    expect(within(guia).getByRole('link', { name: /ir a stock/i }).getAttribute('href')).toBe('/stock')
    expect(within(guia).getByRole('link', { name: /ir a vender/i }).getAttribute('href')).toBe('/vender')
    expect(within(guia).getByRole('link', { name: /ir a ajustes/i }).getAttribute('href')).toBe('/config')
    const barra = within(guia).getByRole('progressbar', { name: /progreso/i })
    expect(barra.getAttribute('value')).toBe('0')
  })

  it('marca solos los pasos al detectar productos y ventas', async () => {
    const yerba = await cargarProducto()
    render(<PantallaInicio />)
    const guia = await screen.findByRole('region', { name: 'Primeros pasos' })
    expect(within(guia).getByText('1 de 3 listos')).toBeTruthy()
    expect(within(guia).queryByRole('link', { name: /ir a stock/i })).toBeNull()

    await vender(yerba.id)
    await waitFor(() => expect(within(guia).getByText('2 de 3 listos')).toBeTruthy())
    expect(within(guia).getByRole('progressbar').getAttribute('value')).toBe('2')
  })

  it('marca el paso del nombre cuando el negocio ya tiene uno propio', async () => {
    await repos.negocio.guardarAjustes('Almacén Don Raúl', null, null)
    render(<PantallaInicio />)
    const guia = await screen.findByRole('region', { name: 'Primeros pasos' })

    expect(within(guia).getByText('1 de 3 listos')).toBeTruthy()
    expect(within(guia).queryByRole('link', { name: /ir a ajustes/i })).toBeNull()
  })

  it('desaparece sola cuando se completan todos los pasos', async () => {
    const yerba = await cargarProducto()
    await vender(yerba.id)
    await repos.negocio.guardarAjustes('Almacén Don Raúl', null, null)
    render(<PantallaInicio />)
    await screen.findByRole('link', { name: /^vender/i })

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Primeros pasos' })).toBeNull())
  })

  it('"Ocultar guía" la saca y se acuerda por negocio', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', rol: 'dueno' })
    const { unmount } = render(<PantallaInicio />)
    await screen.findByRole('region', { name: 'Primeros pasos' })

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar guía' }))

    expect(screen.queryByRole('region', { name: 'Primeros pasos' })).toBeNull()
    expect(window.localStorage.getItem(claveGuia('n-1'))).toBe('1')
    // nada se borró: los datos siguen ahí y Vender sigue andando
    expect(screen.getByRole('link', { name: /^vender/i }).getAttribute('href')).toBe('/vender')

    unmount()
    render(<PantallaInicio />)
    await screen.findByRole('link', { name: /^vender/i })
    expect(screen.queryByRole('region', { name: 'Primeros pasos' })).toBeNull()
  })

  it('ocultarla en un negocio no la oculta en otro', async () => {
    window.localStorage.setItem(claveGuia('otro-negocio'), '1')
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', rol: 'dueno' })
    render(<PantallaInicio />)

    expect(await screen.findByRole('region', { name: 'Primeros pasos' })).toBeTruthy()
  })

  it('el vendedor sólo ve el paso de vender, no los del dueño', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-2', rol: 'vendedor' })
    render(<PantallaInicio />)
    const guia = await screen.findByRole('region', { name: 'Primeros pasos' })

    expect(within(guia).getByText('0 de 1 listos')).toBeTruthy()
    expect(within(guia).getByRole('link', { name: /ir a vender/i })).toBeTruthy()
    expect(within(guia).queryByRole('link', { name: /ir a stock/i })).toBeNull()
    expect(within(guia).queryByRole('link', { name: /ir a ajustes/i })).toBeNull()
    expect(screen.queryByText('Todavía no cargaste productos')).toBeNull()
  })

  it('un negocio sin productos muestra un estado vacío con la acción clara', async () => {
    render(<PantallaInicio />)
    const titulo = await screen.findByRole('heading', { name: 'Todavía no cargaste productos' })
    const bloque = titulo.closest('section') as HTMLElement

    expect(within(bloque).getByRole('link', { name: 'Cargar producto' }).getAttribute('href')).toBe('/stock')
  })

  it('con productos cargados ya no hay estado vacío', async () => {
    await cargarProducto()
    render(<PantallaInicio />)
    await screen.findByRole('region', { name: 'Primeros pasos' })

    expect(screen.queryByText('Todavía no cargaste productos')).toBeNull()
  })

  it('es accesible: región con nombre, lista ordenada, botón y enlaces alcanzables por teclado', async () => {
    render(<PantallaInicio />)
    const guia = await screen.findByRole('region', { name: 'Primeros pasos' })

    expect(within(guia).getByRole('heading', { name: 'Primeros pasos' })).toBeTruthy()
    expect(within(guia).getAllByRole('listitem')).toHaveLength(3)
    const boton = within(guia).getByRole('button', { name: 'Ocultar guía' })
    expect(boton.getAttribute('type')).toBe('button')
    expect(boton.getAttribute('tabindex')).toBeNull()
    for (const enlace of within(guia).getAllByRole('link')) expect(enlace.getAttribute('tabindex')).not.toBe('-1')
  })
})
