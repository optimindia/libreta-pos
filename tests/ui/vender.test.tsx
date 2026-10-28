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
    // el total vive en la barra de abajo y en el ticket
    expect((await screen.findAllByText('$0')).length).toBeGreaterThanOrEqual(1)
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
    fireEvent.click(await screen.findByRole('radio', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '5000' } })
    fireEvent.click(await screen.findByRole('button', { name: /cobrar \$4\.200/i }))
    await waitFor(async () => expect(await repos.ventas.todas()).toHaveLength(1))
  })

  it('exige confirmar una transferencia y permite guardar su referencia', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('radio', { name: /transferencia/i }))
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
    fireEvent.click(await screen.findByRole('radio', { name: /^fiado$/i }))
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
    fireEvent.click(await screen.findByRole('radio', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '5000' } })
    expect(await screen.findByText('$800')).toBeDefined()
  })

  it('si el pago no alcanza, no deja cobrar y avisa cuánto falta', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('radio', { name: /efectivo/i }))
    fireEvent.change(await screen.findByLabelText(/con cuánto pagó/i), { target: { value: '3000' } })
    expect(await screen.findByText(/le faltan \$1\.200/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /cobrar \$4\.200/i })).toHaveProperty('disabled', true)
  })

  it('no deja cobrar un ticket vacío', async () => {
    render(<PantallaVender />)
    await screen.findByText('Yerba Playadito')
    // la barra de cobro sólo aparece cuando hay algo en el ticket
    expect(screen.queryByRole('button', { name: /^cobrar$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /cobrar venta/i })).toHaveProperty('disabled', true)
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
    const agotado = await screen.findByRole('button', { name: /^Agotado.*sin stock/i })
    expect(agotado).toHaveProperty('disabled', true)
  })

  it('lo reservado para un pedido cuenta como vendido: no se puede agregar', async () => {
    const leche = await repos.productos.guardar({ codigoBarras: null, nombre: 'Leche', costo: 100, precio: 200, stock: 2, stockMinimo: 1 })
    await repos.pedidos.guardar({
      clienteId: null, items: [{ productoId: leche.id, nombre: 'Leche', cantidad: 2, precio: 200, costo: 100 }],
      estado: 'pendiente', reservarStock: true, tipoEntrega: 'retiro', fechaEntrega: null, direccion: null, nota: null,
    })
    render(<PantallaVender />)
    const boton = await screen.findByRole('button', { name: /^Leche.*sin stock/i })
    expect(boton).toHaveProperty('disabled', true)
  })

  it('un producto sin precio pide el precio antes de entrar al ticket', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Chinchulín', costo: 0, precio: 0, stock: 12, stockMinimo: 1 })
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Chinchulín.*ponerle precio/i }))

    const campo = await screen.findByLabelText('Precio de Chinchulín')
    fireEvent.click(screen.getByRole('button', { name: /guardar y agregar/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()

    fireEvent.change(campo, { target: { value: '3500' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar y agregar/i }))

    await waitFor(() => expect(screen.getAllByText('$3.500').length).toBeGreaterThan(0))
    const guardado = (await repos.productos.todos()).find((producto) => producto.nombre === 'Chinchulín')
    expect(guardado?.precio).toBe(350000)
  })

  it('con muchos productos aparece el buscador y filtra', async () => {
    await cargarProductos(8)
    render(<PantallaVender />)
    const buscador = await screen.findByLabelText('Buscar producto')
    fireEvent.change(buscador, { target: { value: 'Yerba' } })
    expect(await screen.findByText('Yerba Playadito')).toBeDefined()
    expect(screen.queryByText('Producto 0')).toBeNull()
  })

  it('el cobro en efectivo se completa con los billetes y el teclado', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))

    // arranca en efectivo y sin pago: no se puede cobrar todavía
    expect(screen.getByRole('button', { name: /cobrar \$4\.200/i })).toHaveProperty('disabled', true)

    // $5.000 es uno de los billetes sugeridos para $4.200
    fireEvent.click(screen.getByRole('button', { name: '$5.000' }))
    expect((screen.getByLabelText(/con cuánto pagó/i) as HTMLInputElement).value).toBe('5.000')
    expect(screen.getByText('$800')).toBeDefined()
    expect(screen.getByRole('button', { name: /cobrar \$4\.200/i })).toHaveProperty('disabled', false)

    // borrar y volver a tipear con el teclado
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    fireEvent.click(screen.getByRole('button', { name: '000' }))
    expect((screen.getByLabelText(/con cuánto pagó/i) as HTMLInputElement).value).toBe('500.000')
  })

  it('"Justo" cobra sin vuelto', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Justo' }))

    expect((screen.getByLabelText(/con cuánto pagó/i) as HTMLInputElement).value).toBe('4.200')
    // el vuelto es $0: el tablero lo muestra y el botón queda habilitado
    expect(screen.getAllByText('$0').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /cobrar \$4\.200/i })).toHaveProperty('disabled', false)
  })

  it('al cobrar muestra la hoja de "Cobrado" con la ganancia y deja empezar otra venta', async () => {
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Justo' }))
    fireEvent.click(screen.getByRole('button', { name: /cobrar \$4\.200/i }))

    expect(await screen.findByText(/cobrado en efectivo/i)).toBeDefined()
    expect(screen.getByText('$1.200')).toBeDefined()
    expect(screen.getByRole('link', { name: /mandar el ticket por whatsapp/i })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /nueva venta/i }))
    await waitFor(() => expect(screen.queryByText(/cobrado en efectivo/i)).toBeNull())
  })

  it('una baldosa muestra cuántas unidades lleva el ticket', async () => {
    render(<PantallaVender />)
    const baldosa = await screen.findByText('Yerba Playadito')
    fireEvent.click(baldosa)
    fireEvent.click(baldosa)

    expect(await screen.findByLabelText('2 en el ticket')).toBeDefined()
  })

  it('fiar por encima del límite del cliente pide confirmación', async () => {
    const raul = await repos.clientes.guardar({ nombre: 'Raúl', telefono: null, limiteFiado: 500000 })
    await db.fiados.add({ id: 'f1', clienteId: raul.id, ventaId: null, monto: 300000, fecha: Date.now(), vence: null })
    render(<PantallaVender />)
    fireEvent.click(await screen.findByText('Yerba Playadito'))
    fireEvent.click(await screen.findByRole('button', { name: /^cobrar$/i }))
    fireEvent.click(await screen.findByRole('radio', { name: /^fiado$/i }))

    expect(await screen.findByText('Debe $3.000')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /anotar fiado a raúl/i }))

    // $3.000 + $4.200 pasa el límite de $5.000: no se anota sin confirmar
    const aviso = await screen.findByRole('alertdialog', { name: /límite de fiado/i })
    expect(aviso.textContent).toContain('$7.200')
    expect(await db.ventas.count()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /anotar igual/i }))
    await waitFor(async () => expect(await db.ventas.count()).toBe(1))
  })

  it('el lector físico funciona aunque el código caiga en el buscador', async () => {
    await repos.productos.guardar({ codigoBarras: '7791234', nombre: 'Galletitas', costo: 10000, precio: 250000, stock: 4, stockMinimo: 1 })
    render(<PantallaVender />)
    const buscador = await screen.findByLabelText('Buscar producto')
    await screen.findByText('Galletitas')
    buscador.focus()
    // el lector tipea todo de golpe y cierra con Enter
    for (const tecla of '7791234') fireEvent.keyDown(buscador, { key: tecla })
    fireEvent.change(buscador, { target: { value: '7791234' } })
    fireEvent.keyDown(buscador, { key: 'Enter' })
    await waitFor(() => expect(screen.getAllByText('$2.500').length).toBeGreaterThan(1))
    await waitFor(() => expect((buscador as HTMLInputElement).value).toBe(''))
  })

  it('un código que no es de ningún producto queda como búsqueda común en el buscador', async () => {
    render(<PantallaVender />)
    const buscador = await screen.findByLabelText('Buscar producto')
    for (const tecla of '999888') fireEvent.keyDown(buscador, { key: tecla })
    fireEvent.change(buscador, { target: { value: '999888' } })
    fireEvent.keyDown(buscador, { key: 'Enter' })
    await new Promise((seguir) => setTimeout(seguir, 50))
    expect((buscador as HTMLInputElement).value).toBe('999888')
  })
})
