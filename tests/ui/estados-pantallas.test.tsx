import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { PantallaClientes } from '@/ui/clientes/PantallaClientes'
import { PantallaPedidos } from '@/ui/pedidos/PantallaPedidos'
import { PantallaFiados } from '@/ui/fiados/PantallaFiados'
import { PantallaHistorial } from '@/ui/historial/PantallaHistorial'
import { PantallaStock } from '@/ui/stock/PantallaStock'
import { PantallaPlata } from '@/ui/plata/PantallaPlata'
import { PantallaInicio } from '@/ui/inicio/PantallaInicio'
import { CatalogoVender } from '@/ui/vender/CatalogoVender'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('listas vacías: dicen qué hacer a continuación', () => {
  it('clientes', async () => {
    render(<PantallaClientes />)
    expect(await screen.findByRole('heading', { name: 'Todavía no tenés clientes' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /agregar cliente/i }).length).toBeGreaterThanOrEqual(2)
  })

  it('pedidos', async () => {
    render(<PantallaPedidos />)
    expect(await screen.findByRole('heading', { name: 'Todavía no tenés pedidos' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /agregar pedido/i }).length).toBeGreaterThanOrEqual(2)
  })

  it('fiados', async () => {
    render(<PantallaFiados />)
    expect(await screen.findByRole('heading', { name: 'No te debe nadie' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Agregar cliente' }).length).toBeGreaterThanOrEqual(1)
  })

  it('historial lleva a vender', async () => {
    render(<PantallaHistorial />)
    expect(await screen.findByRole('heading', { name: 'Todavía no tenés ventas' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /ir a vender/i }).getAttribute('href')).toBe('/vender')
  })

  it('stock invita a cargar el primer producto', async () => {
    render(<PantallaStock />)
    expect(await screen.findByRole('heading', { name: 'Todavía no tenés productos' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Cargar producto' })).toBeTruthy()
  })

  it('el catálogo de vender lleva a cargar productos', () => {
    render(<CatalogoVender productos={[]} cantidades={{}} busqueda="" onBuscar={() => undefined} onElegir={() => undefined} />)
    expect(screen.getByText('Todavía no tenés productos')).toBeTruthy()
    expect(screen.getByRole('link', { name: /cargar producto/i }).getAttribute('href')).toBe('/stock')
  })

  it('plata: cada bloque vacío explica qué falta', async () => {
    render(<PantallaPlata />)
    expect(await screen.findByText('Todavía no hay ventas en este período')).toBeTruthy()
    expect(screen.getByText('No tenés nada para reponer')).toBeTruthy()
  })
})

describe('cargas', () => {
  it('plata muestra el esqueleto mientras prepara los datos', () => {
    render(<PantallaPlata />)
    const estado = screen.getByRole('status')
    expect(estado.textContent).toContain('Preparando tu resumen…')
    expect(estado.querySelector('.f-estado-barra')).toBeTruthy()
  })

  it('inicio avisa que está cargando', () => {
    render(<PantallaInicio />)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
