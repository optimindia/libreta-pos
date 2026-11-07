import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { encolar, MAX_INTENTOS, marcarFallido, marcarRechazado } from '@/datos/local/cola'
import { AvisoSinSubir } from '@/ui/sistema/AvisoSinSubir'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => cleanup())

describe('Aviso de cambios que no llegaron a la nube', () => {
  it('no aparece mientras lo pendiente se sigue reintentando solo', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    render(<AvisoSinSubir />)
    await new Promise((listo) => setTimeout(listo, 50))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa cuando se agotaron los intentos y "Reintentar" los vuelve a activar', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    for (let i = 0; i < MAX_INTENTOS; i++) await marcarFallido('venta:v1', new Error('sin red'))
    render(<AvisoSinSubir />)
    expect(await screen.findByText('1 cambio no llegó a la nube')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect((await db.cola.get('venta:v1'))?.intentos).toBe(0)
  })

  it('dice que la nube rechazó algo cuando es un rechazo', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v2' })
    await marcarRechazado('venta:v1', { message: 'permission denied' })
    await marcarRechazado('venta:v2', { message: 'permission denied' })
    render(<AvisoSinSubir />)
    expect(await screen.findByText('2 cambios no llegaron a la nube')).toBeTruthy()
    expect(screen.getByText(/La nube rechazó algo/)).toBeTruthy()
  })
})
