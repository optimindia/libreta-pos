import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { PantallaFiados } from '@/ui/fiados/PantallaFiados'
import { textoUltimoAviso } from '@/dominio/mensajes'

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
  const ayer = Date.now() - 86_400_000
  const marta = await repos.clientes.guardar({ nombre: 'Marta', telefono: '2615551234' })
  await repos.fiados.anotar({ clienteId: marta.id, ventaId: null, monto: 500000, vence: ayer })
  const jose = await repos.clientes.guardar({ nombre: 'José', telefono: null })
  await repos.fiados.anotar({ clienteId: jose.id, ventaId: null, monto: 200000, vence: ayer })
})
afterEach(() => cleanup())

describe('Recordatorios de deuda', () => {
  it('cada fila tiene WhatsApp en un toque', async () => {
    render(<PantallaFiados />)
    const enlace = await screen.findByRole('link', { name: 'Recordarle a Marta por WhatsApp' })
    expect(enlace.getAttribute('href')).toContain('wa.me/542615551234')
    expect(screen.queryByRole('link', { name: 'Recordarle a José por WhatsApp' })).toBeNull()
  })

  it('avisa a los vencidos uno por uno y marca a quién ya se le avisó', async () => {
    render(<PantallaFiados />)
    fireEvent.click(await screen.findByRole('button', { name: /Avisar a los 2 vencidos/ }))
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByText('0 de 1 avisados hoy')).toBeTruthy()
    expect(within(hoja).getByText(/Sin teléfono: José/)).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('link', { name: 'Avisar a Marta' }))
    expect(await within(hoja).findByText('1 de 1 avisados hoy')).toBeTruthy()
    expect(within(hoja).getByRole('link', { name: 'Volver a avisar a Marta' })).toBeTruthy()
  })
})

describe('textoUltimoAviso', () => {
  it('dice hoy, ayer o hace cuántos días', () => {
    const ahora = new Date('2026-11-07T10:00:00').getTime()
    expect(textoUltimoAviso(new Date('2026-11-07T08:00:00').getTime(), ahora)).toBe('Avisado hoy')
    expect(textoUltimoAviso(new Date('2026-11-06T23:00:00').getTime(), ahora)).toBe('Avisado ayer')
    expect(textoUltimoAviso(new Date('2026-11-03T12:00:00').getTime(), ahora)).toBe('Avisado hace 4 días')
  })
})
