import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { Navegacion } from '@/ui/sistema/Navegacion'
import { GuardiaFuncion } from '@/ui/sistema/GuardiaFuncion'

let ruta = '/fiados'
vi.mock('next/navigation', () => ({ usePathname: () => ruta }))

async function comoVendedor() {
  await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-2', rol: 'vendedor', nombreUsuario: 'Lucía' })
}

beforeEach(async () => {
  ruta = '/fiados'
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('min-width'), media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

describe('Acceso de vendedor', () => {
  it('el menú del vendedor no tiene Plata ni Ajustes', async () => {
    await comoVendedor()
    render(<Navegacion />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones principales' })).getByRole('button', { name: 'Más' }))
    const hoja = screen.getByRole('dialog', { name: 'Más secciones' })

    expect(await within(hoja).findByRole('link', { name: 'Clientes' })).toBeTruthy()
    await waitFor(() => expect(within(hoja).queryByRole('link', { name: 'Plata' })).toBeNull())
    expect(within(hoja).queryByRole('link', { name: 'Ajustes' })).toBeNull()
  })

  it('entrar directo a /plata muestra que es del dueño', async () => {
    await comoVendedor()
    ruta = '/plata'
    render(<GuardiaFuncion><p>números del dueño</p></GuardiaFuncion>)

    expect(await screen.findByRole('heading', { name: /la ve el dueño/i })).toBeTruthy()
    expect(screen.queryByText('números del dueño')).toBeNull()
  })

  it('el dueño sigue entrando a /plata', async () => {
    ruta = '/plata'
    render(<GuardiaFuncion><p>números del dueño</p></GuardiaFuncion>)
    expect(await screen.findByText('números del dueño')).toBeTruthy()
  })
})
