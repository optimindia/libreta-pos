import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { EstadoError } from '@/ui/sistema/EstadoError'

describe('EstadoVacio', () => {
  it('dice qué pasa y qué hacer a continuación', () => {
    render(<EstadoVacio titulo="Todavía no tenés clientes" texto="Agregá el primero." />)
    expect(screen.getByRole('heading', { name: 'Todavía no tenés clientes' })).toBeTruthy()
    expect(screen.getByText('Agregá el primero.')).toBeTruthy()
  })

  it('la acción principal es un botón que responde al toque', () => {
    const alTocar = vi.fn()
    render(<EstadoVacio titulo="Vacío" texto="Probá." accion={{ etiqueta: 'Agregar cliente', alTocar }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar cliente' }))
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it('la acción puede ser un enlace', () => {
    render(<EstadoVacio titulo="Vacío" texto="Probá." accion={{ etiqueta: 'Ir a vender', href: '/vender' }} />)
    expect(screen.getByRole('link', { name: /ir a vender/i }).getAttribute('href')).toBe('/vender')
  })

  it('sin acción no dibuja botones', () => {
    render(<EstadoVacio titulo="Vacío" texto="Nada por ahora." />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('en versión compacta no agrega un título de sección', () => {
    render(<EstadoVacio compacto titulo="Sin ventas" texto="Cuando cobres, aparecen acá." />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('Sin ventas')).toBeTruthy()
  })
})

describe('EstadoCarga', () => {
  it('avisa a los lectores de pantalla que está trabajando', () => {
    render(<EstadoCarga texto="Preparando tu resumen…" />)
    const estado = screen.getByRole('status')
    expect(estado.getAttribute('aria-busy')).toBe('true')
    expect(estado.textContent).toContain('Preparando tu resumen…')
  })

  it('dibuja un esqueleto liviano, no un spinner', () => {
    const { container } = render(<EstadoCarga texto="Cargando…" filas={4} />)
    expect(container.querySelectorAll('.f-estado-barra')).toHaveLength(4)
  })
})

describe('EstadoError', () => {
  it('es una alerta con el botón Reintentar', () => {
    const reintentar = vi.fn()
    render(<EstadoError titulo="No pudimos cargar" texto="Revisá la señal." onReintentar={reintentar} />)
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it('sin forma de reintentar no ofrece el botón', () => {
    render(<EstadoError titulo="No pudimos cargar" texto="Pasó algo." />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
