import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { Navegacion } from '@/ui/sistema/Navegacion'

vi.mock('next/navigation', () => ({ usePathname: () => '/fiados' }))

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('min-width'), media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

const barraDeAbajo = () => screen.getByRole('navigation', { name: 'Secciones principales' })

describe('Navegacion', () => {
  it('en el celu muestra Inicio, dos secciones, VENDER al centro y Más', () => {
    render(<Navegacion />)
    const barra = within(barraDeAbajo())

    expect(barra.getByRole('link', { name: 'Inicio' })).toBeTruthy()
    expect(barra.getByRole('link', { name: /^Fiados/ }).getAttribute('aria-current')).toBe('page')
    expect(barra.getByRole('link', { name: 'Stock' })).toBeTruthy()
    expect(barra.getByRole('link', { name: 'Vender' }).getAttribute('href')).toBe('/vender')
    expect(barra.queryByRole('link', { name: 'Plata' })).toBeNull()
  })

  it('"Más" abre una hoja con el resto de las secciones y se cierra con Esc', () => {
    render(<Navegacion />)
    fireEvent.click(within(barraDeAbajo()).getByRole('button', { name: 'Más' }))

    const hoja = screen.getByRole('dialog', { name: 'Más secciones' })
    expect(within(hoja).getByRole('link', { name: 'Plata' })).toBeTruthy()
    expect(within(hoja).getByRole('link', { name: 'Ajustes' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ocultar una sección la saca del menú y se puede volver a mostrar', () => {
    render(<Navegacion />)
    const lateral = within(screen.getByRole('navigation', { name: 'Secciones' }))
    expect(lateral.getByRole('link', { name: 'Pedidos' })).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar menú' })[0])
    const editor = within(screen.getByRole('dialog', { name: 'Editar menú' }))
    const interruptor = editor.getByRole('switch', { name: 'Mostrar Pedidos en el menú' })
    fireEvent.click(interruptor)

    expect(interruptor.getAttribute('aria-checked')).toBe('false')
    expect(lateral.queryByRole('link', { name: 'Pedidos' })).toBeNull()

    fireEvent.click(interruptor)
    expect(lateral.getByRole('link', { name: 'Pedidos' })).toBeTruthy()
  })

  it('Vender no se puede ocultar', () => {
    render(<Navegacion />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar menú' })[0])
    const editor = within(screen.getByRole('dialog', { name: 'Editar menú' }))

    expect(editor.queryByRole('switch', { name: /Vender/ })).toBeNull()
    expect(editor.getAllByText('Siempre visible')).toHaveLength(2)
  })

  it('Ctrl+B achica la barra lateral y lo recuerda', () => {
    render(<Navegacion />)
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })

    expect(screen.getByRole('complementary', { name: 'Menú de Libreta' }).getAttribute('data-compacta')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem('libreta-menu')!).compacta).toBe(true)
  })
})
