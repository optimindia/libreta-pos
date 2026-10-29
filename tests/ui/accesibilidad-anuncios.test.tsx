import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaVender } from '@/ui/vender/PantallaVender'
import { FormularioProducto } from '@/ui/stock/FormularioProducto'

let alDetectar: ((codigo: string) => void) | null = null
vi.mock('@/ui/vender/escaner', () => ({
  escanear: vi.fn(async (_video: HTMLVideoElement, alLeer: (codigo: string) => void) => {
    alDetectar = alLeer
    return Object.assign(vi.fn(), { hayLinterna: false })
  }),
}))
vi.mock('@/ui/escaner/sonido', () => ({ avisarLectura: vi.fn() }))

import { VisorCamara } from '@/ui/escaner/VisorCamara'

beforeEach(async () => {
  alDetectar = null
  await db.delete()
  await db.open()
})

/** El texto que anuncia el lector de pantalla: lo que hay en las regiones vivas. */
const anunciado = () => [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].map((n) => n.textContent).join(' | ')

describe('Vender: anuncios para lector de pantalla', () => {
  it('la región viva del total existe desde el principio, vacía, y se actualiza con cada cambio', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba Playadito', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3 })
    render(<PantallaVender />)
    const region = document.querySelector<HTMLElement>('[data-anuncio="venta"]')
    expect(region, 'tiene que estar montada antes del primer cambio').not.toBeNull()
    expect(region!.getAttribute('aria-live')).toBe('polite')
    expect(region!.getAttribute('aria-atomic')).toBe('true')
    expect(region!.closest('button')).toBeNull()
    expect(region!.textContent).toBe('')

    fireEvent.click(await screen.findByRole('button', { name: /^Yerba Playadito/ }))
    await waitFor(() => expect(region!.textContent).toContain('$4.200'))
    expect(region!.textContent).toMatch(/total/i)
    // sigue siendo el mismo nodo: no se re-montó
    expect(document.querySelector('[data-anuncio="venta"]')).toBe(region)

    fireEvent.click(await screen.findByRole('button', { name: /^Yerba Playadito/ }))
    await waitFor(() => expect(region!.textContent).toContain('$8.400'))
  })

  it('el aviso de stock se anuncia por la región persistente, no por un cartel que aparece de golpe', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Leche', costo: 100, precio: 200, stock: 1, stockMinimo: 1 })
    render(<PantallaVender />)
    const region = document.querySelector<HTMLElement>('[data-anuncio="avisos"]')
    expect(region).not.toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /^Leche/ }))
    // ya está la única unidad en el ticket: volver a tocarla avisa que no queda más
    fireEvent.click(screen.getByRole('button', { name: /^Leche/ }))
    await waitFor(() => expect(region!.textContent).toMatch(/solo quedan/i))
    const cartel = document.querySelector('.f-aviso-flotante')
    expect(cartel?.getAttribute('aria-hidden')).toBe('true')
    expect(cartel?.getAttribute('role')).toBeNull()
  })
})

describe('errores asociados al campo (3.3.1)', () => {
  it('PonerPrecio: el campo apunta al mensaje y se marca inválido', async () => {
    await repos.productos.guardar({ codigoBarras: null, nombre: 'Chinchulín', costo: 0, precio: 0, stock: 12, stockMinimo: 1 })
    render(<PantallaVender />)
    fireEvent.click(await screen.findByRole('button', { name: /^Chinchulín.*ponerle precio/i }))
    const campo = await screen.findByLabelText('Precio de Chinchulín')
    expect(campo.getAttribute('aria-describedby')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /guardar y agregar/i }))
    const alerta = await screen.findByRole('alert')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(alerta.id).toBeTruthy()
    expect(campo.getAttribute('aria-describedby')).toContain(alerta.id)
  })

  it('FormularioProducto: nombre, precio y stock apuntan a su mensaje', async () => {
    render(<FormularioProducto />)
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    const alertas = await screen.findAllByRole('alert')
    expect(alertas.length).toBeGreaterThan(0)
    for (const campo of screen.getAllByRole('textbox').filter((c) => c.getAttribute('aria-invalid') === 'true')) {
      const ids = (campo.getAttribute('aria-describedby') ?? '').split(' ')
      expect(alertas.some((a) => a.id && ids.includes(a.id)), `${campo.getAttribute('aria-label')} sin aria-describedby`).toBe(true)
    }
    const nombre = screen.getByLabelText('Nombre')
    expect(nombre.getAttribute('aria-invalid')).toBe('true')
  })

  it('VisorCamara: el campo con error apunta al mensaje', async () => {
    const desconocido = vi.fn(async () => ({ tipo: 'falta' as const, texto: 'No está cargado', codigo: '779052' }))
    render(<VisorCamara titulo="Escaneá" ayuda="Apuntá" onCerrar={vi.fn()} alLeer={desconocido} alCargar={vi.fn()} continuo />)
    await waitFor(() => expect(alDetectar).not.toBeNull())
    await act(async () => { alDetectar?.('779052') })
    fireEvent.click(await screen.findByRole('button', { name: /cargarlo ahora/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y sumar' }))
    const alerta = await screen.findByRole('alert')
    const nombre = screen.getByPlaceholderText(/yerba playadito/i)
    expect(nombre.getAttribute('aria-invalid')).toBe('true')
    expect(nombre.getAttribute('aria-describedby')).toContain(alerta.id)
    expect(anunciado()).toContain('cómo se llama')
  })
})
