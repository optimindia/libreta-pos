import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { Navegacion } from '@/ui/sistema/Navegacion'
import { violacionesAxe } from './axe'

const cerrarSesion = vi.fn(async () => {})
vi.mock('@/datos/nube/sesion', async (original) => ({ ...(await original<object>()), cerrarSesion: () => cerrarSesion() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

beforeEach(async () => {
  cerrarSesion.mockClear()
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('min-width'), media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

const conCuenta = () => db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-1', rol: 'dueno' })

describe('Cerrar sesión desde el menú', () => {
  it('está a mano en la barra lateral y pide confirmar antes de salir', async () => {
    await conCuenta()
    render(<Navegacion />)
    const lateral = screen.getByRole('complementary', { name: 'Menú de Libreta' })
    fireEvent.click(await within(lateral).findByRole('button', { name: 'Cerrar sesión' }))

    const hoja = screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
    expect(cerrarSesion).not.toHaveBeenCalled()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(cerrarSesion).toHaveBeenCalledTimes(1))
  })

  it('"Seguir usando" cierra la hoja sin salir', async () => {
    await conCuenta()
    render(<Navegacion />)
    const lateral = screen.getByRole('complementary', { name: 'Menú de Libreta' })
    fireEvent.click(await within(lateral).findByRole('button', { name: 'Cerrar sesión' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Seguir usando' }))

    expect(screen.queryByRole('dialog', { name: '¿Cerrar sesión?' })).toBeNull()
    expect(cerrarSesion).not.toHaveBeenCalled()
  })

  it('en el celu está dentro de "Más"', async () => {
    await conCuenta()
    render(<Navegacion />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones principales' })).getByRole('button', { name: 'Más' }))
    const hoja = screen.getByRole('dialog', { name: 'Más secciones' })
    expect(await within(hoja).findByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
  })

  it('si hay ventas sin subir avisa que se pierden', async () => {
    await conCuenta()
    await db.cola.add({ id: 'q1', entidad: 'venta', operacion: 'crear', datos: {}, intentos: 0, creadoEn: 1 })
    render(<Navegacion />)
    const lateral = screen.getByRole('complementary', { name: 'Menú de Libreta' })
    fireEvent.click(await within(lateral).findByRole('button', { name: 'Cerrar sesión' }))

    const hoja = screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
    expect(await within(hoja).findByText(/todavía no se subieron/i)).toBeTruthy()
    expect(within(hoja).getByRole('button', { name: 'Cerrar igual' })).toBeTruthy()
  })

  it('sin cuenta en la nube no ofrece cerrar sesión', async () => {
    render(<Navegacion />)
    await screen.findByRole('complementary', { name: 'Menú de Libreta' })
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
  })

  it('la hoja de confirmación no tiene violaciones de accesibilidad', async () => {
    await conCuenta()
    render(<Navegacion />)
    const lateral = screen.getByRole('complementary', { name: 'Menú de Libreta' })
    fireEvent.click(await within(lateral).findByRole('button', { name: 'Cerrar sesión' }))
    expect(await violacionesAxe(screen.getByRole('dialog', { name: '¿Cerrar sesión?' }))).toEqual([])
  })
})
