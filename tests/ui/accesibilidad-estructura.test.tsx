import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const estado = vi.hoisted(() => ({
  ruta: '/',
  saas: true,
  sesion: false,
}))

vi.mock('next/navigation', () => ({ usePathname: () => estado.ruta }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null }))
vi.mock('@/ui/sistema/Navegacion', () => ({ Navegacion: () => <nav aria-label="Secciones">menú</nav> }))
vi.mock('@/datos/nube/acceso', async (original) => ({
  ...(await original<typeof import('@/datos/nube/acceso')>()),
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => estado.saas,
  cargarEstadoAcceso: () => Promise.resolve({
    autenticado: estado.sesion, usuarioId: null, negocio: null, suscripcion: null, online: false, verificadoRemoto: false,
  }),
}))

import { ControlAcceso } from '@/ui/sistema/ControlAcceso'
import { SaltarAlContenido } from '@/ui/sistema/SaltarAlContenido'
import { violacionesAxe } from './axe'

beforeEach(() => {
  estado.ruta = '/'
  estado.saas = true
  estado.sesion = false
})

function principal() {
  const main = document.querySelector('main')
  expect(main, 'cada pantalla necesita un <main>').not.toBeNull()
  expect(document.querySelectorAll('main')).toHaveLength(1)
  return main as HTMLElement
}

function esDestinoDelSalto(main: HTMLElement) {
  expect(main.id).toBe('contenido')
  expect(main.getAttribute('tabindex')).toBe('-1')
}

describe('saltar al contenido', () => {
  it('es el primer enlace y apunta al <main>', () => {
    render(<><SaltarAlContenido /><a href="/x">otro</a></>)
    const enlace = screen.getAllByRole('link')[0]
    expect(enlace.getAttribute('href')).toBe('#contenido')
    expect(enlace.textContent).toBe('Saltar al contenido')
    expect(enlace.className).toContain('f-saltar')
  })

  it('el layout lo pone antes de cualquier otro contenido', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    expect(layout).toContain('<SaltarAlContenido />')
    expect(layout.indexOf('<SaltarAlContenido />')).toBeLessThan(layout.indexOf('<RegistrarSW />'))
  })
})

describe('landmarks y destino del salto en ControlAcceso', () => {
  it('la puerta de entrada (sin sesión) es el <main>', async () => {
    render(<ControlAcceso><p>caja</p></ControlAcceso>)
    await screen.findByRole('button', { name: /entrar a mi negocio/i }, { timeout: 1500 })
    esDestinoDelSalto(principal())
  })

  it('la pantalla de carga tiene su <main>', () => {
    estado.sesion = true
    render(<ControlAcceso><p>caja</p></ControlAcceso>)
    esDestinoDelSalto(principal())
  })

  it('el POS sin nube tiene <main> y menú', () => {
    estado.saas = false
    render(<ControlAcceso><h1>Caja</h1></ControlAcceso>)
    esDestinoDelSalto(principal())
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeTruthy()
  })

  it('las páginas legales tienen <main> propio', () => {
    estado.ruta = '/terminos'
    render(<ControlAcceso><h1>Términos</h1></ControlAcceso>)
    esDestinoDelSalto(principal())
  })

  it('axe: la puerta de entrada completa no tiene violaciones', async () => {
    render(<ControlAcceso><p>caja</p></ControlAcceso>)
    await screen.findByRole('button', { name: /entrar a mi negocio/i }, { timeout: 1500 })
    expect(await violacionesAxe(document.body)).toEqual([])
  })
})

describe('el motor de axe detecta fallas reales (control del control)', () => {
  it('un campo sin nombre y un botón de ícono sin nombre se reportan', async () => {
    render(<div><input /><button type="button"><svg /></button><div role="img" /></div>)
    const violaciones = (await violacionesAxe()).join('\n')
    expect(violaciones).toContain('label')
    expect(violaciones).toContain('button-name')
    expect(violaciones).toContain("role-img-alt")
  })
})
