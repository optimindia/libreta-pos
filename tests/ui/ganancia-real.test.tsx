import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { normalizarAjustes } from '@/datos/local/repos'
import { GananciaReal } from '@/ui/plata/GananciaReal'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => cleanup())

describe('Ganancia real', () => {
  it('carga un gasto fijo y lo guarda en los ajustes del negocio', async () => {
    render(<GananciaReal ventas={[]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar gastos fijos' }))
    fireEvent.change(screen.getByLabelText('Nombre del gasto fijo'), { target: { value: 'Alquiler' } })
    fireEvent.change(screen.getByLabelText('Monto por mes'), { target: { value: '150000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(async () => {
      const ajustes = normalizarAjustes((await db.preferencias.get('unico'))?.ajustes)
      expect(ajustes.gastosFijos?.[0]).toMatchObject({ nombre: 'Alquiler', monto: 15000000 })
    })
    expect(await screen.findByRole('button', { name: 'Quitar Alquiler' })).toBeTruthy()
  })
})
