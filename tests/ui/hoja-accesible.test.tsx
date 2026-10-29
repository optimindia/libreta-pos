import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { Hoja } from '@/ui/sistema/Hoja'
import { violacionesAxe } from './axe'

function Ejemplo() {
  const [abierta, setAbierta] = useState(false)
  const [segunda, setSegunda] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setAbierta(true)}>Abrir hoja</button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Cobrar">
        <input aria-label="Monto" />
        <button type="button" onClick={() => setSegunda(true)}>Más opciones</button>
        <button type="button">Confirmar</button>
      </Hoja>
      <Hoja abierta={segunda} onCerrar={() => setSegunda(false)} titulo="Opciones">
        <button type="button">Elegir</button>
      </Hoja>
    </div>
  )
}

const abrir = () => {
  const opener = screen.getByRole('button', { name: 'Abrir hoja' })
  opener.focus()
  fireEvent.click(opener)
  return opener
}

describe('Hoja', () => {
  it('es un diálogo modal con nombre', () => {
    render(<Ejemplo />)
    abrir()
    const dialogo = screen.getByRole('dialog', { name: 'Cobrar' })
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
  })

  it('el foco entra al diálogo al abrir', () => {
    render(<Ejemplo />)
    abrir()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('Tab en el último control vuelve al primero y Shift+Tab en el primero va al último', () => {
    render(<Ejemplo />)
    abrir()
    const dialogo = within(screen.getByRole('dialog'))
    const cerrar = dialogo.getByRole('button', { name: 'Cerrar' })
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar' })
    confirmar.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cerrar)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmar)
  })

  it('si el foco se escapó del diálogo, Tab lo trae de vuelta adentro', () => {
    render(<Ejemplo />)
    const opener = abrir()
    opener.focus()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(false)
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('Escape cierra y devuelve el foco a quien la abrió', () => {
    render(<Ejemplo />)
    const opener = abrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('con dos hojas apiladas, Escape cierra sólo la de arriba', () => {
    render(<Ejemplo />)
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Cobrar' })).toBeTruthy()
  })

  it('con dos hojas apiladas, Tab se queda en la de arriba', () => {
    render(<Ejemplo />)
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }))
    const arriba = screen.getByRole('dialog', { name: 'Opciones' })
    const elegir = within(arriba).getByRole('button', { name: 'Elegir' })
    elegir.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(arriba.contains(document.activeElement)).toBe(true)
  })

  it('el fondo queda inerte mientras está abierta y vuelve a la vida al cerrar', () => {
    render(<Ejemplo />)
    abrir()
    const opener = screen.getByText('Abrir hoja')
    expect(opener.closest('[inert]')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText('Abrir hoja').closest('[inert]')).toBeNull()
  })

  it('no tiene violaciones de axe abierta', async () => {
    render(<Ejemplo />)
    abrir()
    expect(await violacionesAxe(screen.getByRole('dialog'))).toEqual([])
  })
})
