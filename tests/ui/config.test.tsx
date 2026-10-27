import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { PantallaConfig } from '@/ui/config/PantallaConfig'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PantallaConfig', () => {
  it('guarda el nombre del negocio', async () => {
    render(<PantallaConfig />)
    fireEvent.change(await screen.findByLabelText('Nombre del negocio'), {
      target: { value: 'Almacén Rosales' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(async () => {
      const negocio = await db.negocio.get('unico')
      expect(negocio?.nombre).toBe('Almacén Rosales')
    })
  })

  it('guarda el color de la marca del cliente', async () => {
    render(<PantallaConfig />)
    fireEvent.change(await screen.findByLabelText('Nombre del negocio'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#B4642A' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(async () => {
      // el input de color siempre devuelve en minúscula
      expect((await db.negocio.get('unico'))?.color?.toLowerCase()).toBe('#b4642a')
    })
  })

  it('al guardar los ajustes conserva el vínculo con la nube', async () => {
    await db.negocio.put({
      id: 'unico', nombre: 'Viejo', logo: null, color: null,
      negocioId: 'negocio-1', telefono: '542615551234', ultimaBajada: 1234,
    })
    render(<PantallaConfig />)
    fireEvent.change(await screen.findByLabelText('Nombre del negocio'), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(async () => {
      const negocio = await db.negocio.get('unico')
      expect(negocio).toMatchObject({ nombre: 'Nuevo', negocioId: 'negocio-1', telefono: '542615551234', ultimaBajada: 1234 })
    })
  })

  it('precarga lo que ya estaba guardado', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Ya estaba', logo: null, color: null })
    render(<PantallaConfig />)
    await waitFor(() => {
      const campo = screen.getByLabelText('Nombre del negocio') as HTMLInputElement
      expect(campo.value).toBe('Ya estaba')
    })
  })

  it('permite desactivar una función opcional desde el panel del negocio', async () => {
    render(<PantallaConfig />)
    const pedidos = await screen.findByRole('switch', { name: /Pedidos/ })
    expect(pedidos.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(pedidos)

    await waitFor(async () => {
      expect((await db.preferencias.get('unico'))?.funciones.pedidos).toBe(false)
    })
    expect(screen.getByRole('switch', { name: /Pedidos/ }).getAttribute('aria-checked')).toBe('false')
  })
})
