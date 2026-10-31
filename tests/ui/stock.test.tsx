import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaStock } from '@/ui/stock/PantallaStock'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaStock', () => {
  it('da de alta un producto con precio en pesos y lo guarda en centavos', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Fideos' } })
    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '800' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '1200' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))

    await waitFor(async () => {
      const productos = await repos.productos.todos()
      expect(productos).toHaveLength(1)
      expect(productos[0].precio).toBe(120000)
    })
  })

  it('avisa cuáles productos están por debajo del mínimo', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 1, stockMinimo: 5,
    })
    render(<PantallaStock />)
    expect(await screen.findByText(/te está faltando/i)).toBeDefined()
  })

  it('no guarda un producto sin nombre', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /guardar producto/i }))
    await waitFor(async () => expect(await repos.productos.todos()).toHaveLength(0))
  })

  it('permite cargar stock inicial, ajustarlo y editar el producto', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Aceite' } })
    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '900' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '1400' } })
    fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))

    await waitFor(async () => expect((await repos.productos.todos())[0].stock).toBe(5))
    fireEvent.click(await screen.findByRole('button', { name: /ajustar stock de aceite/i }))
    fireEvent.change(screen.getByLabelText(/cantidad a ajustar de aceite/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /^listo$/i }))
    await waitFor(async () => expect((await repos.productos.todos())[0].stock).toBe(7))

    fireEvent.click(screen.getByRole('button', { name: /editar aceite/i }))
    expect(screen.getByRole('dialog', { name: /editar aceite/i })).toBeDefined()
    fireEvent.change(await screen.findByLabelText('Precio'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(async () => expect((await repos.productos.todos())[0].precio).toBe(150000))
  })

  it('avisa si se intenta restar más stock del disponible', async () => {
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Leche', costo: 70000, precio: 100000, stock: 2, stockMinimo: 1,
    })
    render(<PantallaStock />)

    fireEvent.click(await screen.findByRole('button', { name: /ajustar stock de leche/i }))
    fireEvent.change(screen.getByLabelText(/tipo de ajuste para leche/i), { target: { value: 'restar' } })
    fireEvent.change(screen.getByLabelText(/cantidad a ajustar de leche/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /^listo$/i }))

    expect(await screen.findByText(/no podés restar 3/i)).toBeDefined()
    expect((await repos.productos.todos())[0].stock).toBe(2)
  })

  it('rechaza duplicar un código de barras', async () => {
    await repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba', costo: 30000, precio: 50000, stock: 1, stockMinimo: 1 })
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Otra yerba' } })
    fireEvent.change(screen.getByLabelText('Código de barras'), { target: { value: '779' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))
    expect(await screen.findByText(/ese código ya pertenece/i)).toBeDefined()
    expect(await repos.productos.todos()).toHaveLength(1)
  })

  it('elimina un producto sin historial desde una confirmación visible', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Galletitas', costo: 50000, precio: 90000, stock: 4, stockMinimo: 1 })
    render(<PantallaStock />)

    fireEvent.click(await screen.findByRole('button', { name: /eliminar galletitas/i }))
    expect(screen.getByRole('alertdialog', { name: /eliminar galletitas/i })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))

    await waitFor(async () => expect(await repos.productos.todos()).toHaveLength(0))
    expect(await screen.findByText(/galletitas fue eliminado/i)).toBeDefined()
  })

  it('bloquea el borrado de un producto con historial y explica por qué', async () => {
    const producto = await repos.productos.guardar({ codigoBarras: null, nombre: 'Leche', costo: 70000, precio: 100000, stock: 2, stockMinimo: 1 })
    await db.ventas.put({
      id: 'venta-historica', fecha: Date.now(), total: producto.precio, medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: 1, precio: producto.precio, costo: producto.costo }],
    })
    render(<PantallaStock />)

    fireEvent.click(await screen.findByRole('button', { name: /eliminar leche/i }))
    fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))

    expect(await screen.findByText(/no se puede eliminar este producto porque tiene historial: 1 venta/i)).toBeDefined()
    expect(await repos.productos.todos()).toHaveLength(1)
  })

  it('entiende los importes como se escriben acá: "1.200" son mil doscientos y "800,50" ochocientos con cincuenta', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Aceite' } })
    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '800,50' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '1.200' } })
    fireEvent.change(screen.getByLabelText('Oferta promocional'), { target: { value: '1.050' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))

    await waitFor(async () => expect(await repos.productos.todos()).toHaveLength(1))
    const [producto] = await repos.productos.todos()
    expect(producto.costo).toBe(80050)
    expect(producto.precio).toBe(120000)
    expect(producto.precioOferta).toBe(105000)
  })

  it('un producto sin código de barras se guarda sin código y otro más sin código no choca', async () => {
    render(<PantallaStock />)
    for (const nombre of ['Pan lactal', 'Galletitas surtidas']) {
      fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
      fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: nombre } })
      fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '500' } })
      fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))
      await waitFor(async () => expect((await repos.productos.todos()).some((p) => p.nombre === nombre)).toBe(true))
    }
    const productos = await repos.productos.todos()
    expect(productos.map((p) => p.codigoBarras)).toEqual([null, null])
  })
})

describe('Carga en tanda y categorías', () => {
  it('"Guardar y cargar otro" deja la ficha lista y muestra lo cargado', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Yerba' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cargar otro' }))

    expect(await screen.findByText('Cargaste 1 producto')).toBeTruthy()
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Arroz' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '1750' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cargar otro' }))
    expect(await screen.findByText('Cargaste 2 productos')).toBeTruthy()
    await waitFor(async () => expect(await repos.productos.todos()).toHaveLength(2))
  })

  it('un producto por kilo se carga con su precio por kilo y stock con decimales', async () => {
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /^cargar$/i }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Queso cremoso' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Por kilo' }))
    expect(screen.getByText('Precio por kilo')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '9500' } })
    fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '2,5' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))
    await waitFor(async () => {
      const [queso] = await repos.productos.todos()
      expect(queso).toMatchObject({ unidad: 'kg', precio: 950000, stock: 2.5 })
    })
  })

  it('las categorías se pueden renombrar desde el catálogo', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 100, precio: 200, stock: 1, stockMinimo: 0, categoria: 'Almacen' })
    render(<PantallaStock />)
    fireEvent.click(await screen.findByRole('button', { name: /editar categorías/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar el nombre de Almacen' }))
    fireEvent.change(screen.getByLabelText('Nuevo nombre para Almacen'), { target: { value: 'Almacén' } })
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(async () => expect((await repos.productos.todos())[0].categoria).toBe('Almacén'))
  })
})
