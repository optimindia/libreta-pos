import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { Navegacion } from '@/ui/sistema/Navegacion'
import { GuardiaFuncion } from '@/ui/sistema/GuardiaFuncion'
import { repos } from '@/datos/local/repos'
import { PantallaStock } from '@/ui/stock/PantallaStock'
import { PantallaHistorial } from '@/ui/historial/PantallaHistorial'
import { PantallaClientes } from '@/ui/clientes/PantallaClientes'
import { PantallaVender } from '@/ui/vender/PantallaVender'

let ruta = '/fiados'
vi.mock('next/navigation', () => ({ usePathname: () => ruta }))

async function comoVendedor() {
  await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-2', rol: 'vendedor', nombreUsuario: 'Lucía' })
}

beforeEach(async () => {
  ruta = '/fiados'
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('min-width'), media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

describe('Acceso de vendedor', () => {
  it('el menú del vendedor no tiene Plata ni Ajustes', async () => {
    await comoVendedor()
    render(<Navegacion />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones principales' })).getByRole('button', { name: 'Más' }))
    const hoja = screen.getByRole('dialog', { name: 'Más secciones' })

    expect(await within(hoja).findByRole('link', { name: 'Clientes' })).toBeTruthy()
    await waitFor(() => expect(within(hoja).queryByRole('link', { name: 'Plata' })).toBeNull())
    expect(within(hoja).queryByRole('link', { name: 'Ajustes' })).toBeNull()
  })

  it('entrar directo a /plata muestra que es del dueño', async () => {
    await comoVendedor()
    ruta = '/plata'
    render(<GuardiaFuncion><p>números del dueño</p></GuardiaFuncion>)

    expect(await screen.findByRole('heading', { name: /la ve el dueño/i })).toBeTruthy()
    expect(screen.queryByText('números del dueño')).toBeNull()
  })

  it('el dueño sigue entrando a /plata', async () => {
    ruta = '/plata'
    render(<GuardiaFuncion><p>números del dueño</p></GuardiaFuncion>)
    expect(await screen.findByText('números del dueño')).toBeTruthy()
  })
})

describe('El vendedor no ve acciones que la base le rechaza', () => {
  async function conProducto(precio = 420000) {
    return repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba', costo: 300000, precio, stock: 10, stockMinimo: 3 })
  }

  it('Stock: mira el catálogo pero no edita, ajusta, borra, carga ni cambia precios', async () => {
    await conProducto()
    await comoVendedor()
    render(<PantallaStock />)

    expect(await screen.findByText('Yerba')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Editar Yerba' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Ajustar stock de Yerba' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar Yerba' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Cargar$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Precios$/ })).toBeNull()
    expect(screen.queryByText(/a costo/)).toBeNull()
  })

  it('Stock: el dueño sigue teniendo todas las acciones', async () => {
    await conProducto()
    render(<PantallaStock />)
    expect(await screen.findByRole('button', { name: 'Editar Yerba' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ajustar stock de Yerba' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar Yerba' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Cargar$/ })).toBeTruthy()
  })

  it('Historial: el vendedor ve la venta pero no la puede anular', async () => {
    const yerba = await conProducto()
    // El vendedor ve lo que vendió él: la venta se registra ya con su sesión.
    await comoVendedor()
    await repos.ventas.registrar({ items: [{ productoId: yerba.id, nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }], medioPago: 'efectivo', clienteId: null })
    ruta = '/historial'
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByText(/Yerba/))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull())
  })

  it('Historial: el dueño puede anular', async () => {
    const yerba = await conProducto()
    await repos.ventas.registrar({ items: [{ productoId: yerba.id, nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 }], medioPago: 'efectivo', clienteId: null })
    ruta = '/historial'
    render(<PantallaHistorial />)
    fireEvent.click(await screen.findByText(/Yerba/))
    expect(await screen.findByRole('button', { name: 'Anular venta' })).toBeTruthy()
  })

  it('Clientes: el vendedor edita pero no elimina', async () => {
    await repos.clientes.guardar({ nombre: 'Ana', telefono: null })
    await comoVendedor()
    render(<PantallaClientes />)
    expect((await screen.findAllByText('Ana')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Eliminar cliente Ana' })).toBeNull())
    expect(screen.getAllByRole('button', { name: /Editar/ }).length).toBeGreaterThan(0)
  })

  it('Vender: el precio que pone el vendedor vale para esta venta y no cambia la ficha', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Chinchulín', costo: 0, precio: 0, stock: 12, stockMinimo: 1 })
    await comoVendedor()
    await db.cola.clear()
    ruta = '/vender'
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Chinchulín.*Ponerle precio/i }))
    fireEvent.change(await screen.findByLabelText('Precio de Chinchulín'), { target: { value: '3500' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar a la venta/i }))

    await waitFor(() => expect(screen.getAllByText('$3.500').length).toBeGreaterThan(0))
    const ficha = (await repos.productos.todos()).find((producto) => producto.nombre === 'Chinchulín')
    expect(ficha?.precio).toBe(0)
    expect(await db.cola.count()).toBe(0)
  })
})
