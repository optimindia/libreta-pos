import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Portada } from '@/ui/sistema/Portada'
import { violacionesAxe } from './axe'

describe('Portada', () => {
  it('muestra el título como h1, el rótulo, el valor final para el lector y la acción', async () => {
    const { container } = render(
      <Portada id="prueba-1" titulo="Fiados" rotulo="Te deben" valor={2670000} detalle={<p>2 clientes</p>} accion={<button type="button">+ Cliente</button>} />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Fiados' })).toBeTruthy()
    expect(screen.getByText('Te deben')).toBeTruthy()
    // El número que sube es decorativo; el lector de pantalla lee el final.
    expect(container.querySelector('.f-sr')?.textContent).toBe('$26.700')
    expect(screen.getByRole('button', { name: '+ Cliente' })).toBeTruthy()
    expect(await violacionesAxe(container)).toEqual([])
  })

  it('formatea números y sufijos', () => {
    const { container } = render(<Portada id="prueba-2" titulo="Centro Pro" valor={76} formato="numero" sufijo="/100" animar={false} />)
    expect(container.querySelector('.f-sr')?.textContent).toBe('76/100')
    expect(container.querySelector('.f-portada-valor [aria-hidden]')?.textContent).toBe('76/100')
  })

  it('sin valor muestra sólo título y subtítulo', () => {
    render(<Portada id="prueba-3" titulo="Tu negocio" subtitulo="Personalizá tu operación." />)
    expect(screen.getByText('Personalizá tu operación.')).toBeTruthy()
    expect(document.querySelector('.f-portada-valor')).toBeNull()
  })

  it('anima sólo la primera vez que se abre cada sección', () => {
    const primera = render(<Portada id="prueba-4" titulo="Stock" />)
    expect(primera.container.querySelector('.f-portada')?.getAttribute('data-entrada')).toBe('true')
    primera.unmount()
    const segunda = render(<Portada id="prueba-4" titulo="Stock" />)
    expect(segunda.container.querySelector('.f-portada')?.getAttribute('data-entrada')).toBeNull()
  })
})
