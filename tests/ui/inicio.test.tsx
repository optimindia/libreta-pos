import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaInicio } from '@/ui/inicio/PantallaInicio'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaInicio', () => {
  it('VENDER es lo primero y lleva al mostrador', async () => {
    render(<PantallaInicio />)
    const vender = await screen.findByRole('link', { name: /^vender/i })

    expect(vender.getAttribute('href')).toBe('/vender')
    // es el primer enlace de la página: lo que más se usa, arriba de todo
    expect(screen.getAllByRole('link')[0]).toBe(vender)
  })

  it('en un negocio vacío invita a cargar los productos y no inventa números', async () => {
    render(<PantallaInicio />)

    expect(await screen.findByText('Cargá tus productos')).toBeTruthy()
    expect(screen.getByText('Todavía no vendiste nada hoy')).toBeTruthy()
    expect(screen.getByText('Nadie te debe')).toBeTruthy()
  })

  it('muestra lo vendido y lo ganado hoy, lo que te deben y lo que hay que reponer', async () => {
    const yerba = await repos.productos.guardar({
      codigoBarras: null, nombre: 'Yerba Playadito', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3,
    })
    await repos.productos.guardar({
      codigoBarras: null, nombre: 'Fideos Matarazzo', costo: 80000, precio: 148000, stock: 1, stockMinimo: 6,
    })
    await repos.ventas.registrar({
      medioPago: 'efectivo', clienteId: null,
      items: [{ productoId: yerba.id, nombre: 'Yerba Playadito', cantidad: 1, precio: 420000, costo: 300000 }],
    })
    render(<PantallaInicio />)

    // $4.200 vendidos, $1.200 de ganancia, todo en efectivo
    expect((await screen.findAllByText('$4.200')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Ganaste $1.200')).toBeTruthy()
    expect(screen.getByText('1 venta')).toBeTruthy()
    // un faltante, con el nombre del producto
    expect(screen.getByText('Fideos')).toBeTruthy()
  })

  it('cuenta los fiados vencidos y la plata que falta cobrar', async () => {
    const dia = 24 * 60 * 60 * 1000
    const cliente = await repos.clientes.guardar({ nombre: 'Raúl', telefono: null })
    await db.fiados.add({
      id: 'f1', clienteId: cliente.id, ventaId: null, monto: 2130000, fecha: Date.now() - 20 * dia, vence: Date.now() - 12 * dia,
    })
    render(<PantallaInicio />)

    expect(await screen.findByText('$21.300')).toBeTruthy()
    expect(screen.getByText(/1 vencido/)).toBeTruthy()
  })

  it('una función apagada oculta su tarjeta', async () => {
    await db.preferencias.put({
      id: 'unico', actualizadoEn: 1, funciones: { fiados: false },
    } as never)
    render(<PantallaInicio />)
    await screen.findByRole('link', { name: /^vender/i })

    expect(screen.queryByText('Te deben')).toBeNull()
  })

  it('los atajos llevan a donde dicen', async () => {
    render(<PantallaInicio />)
    await screen.findByRole('link', { name: /^vender/i })

    expect(screen.getByRole('link', { name: /foto de factura/i }).getAttribute('href')).toBe('/stock')
    expect(screen.getByRole('link', { name: /anotar un gasto/i }).getAttribute('href')).toBe('/plata')
    expect(screen.getByRole('link', { name: /cerrar caja/i }).getAttribute('href')).toBe('/plata')
  })
})
