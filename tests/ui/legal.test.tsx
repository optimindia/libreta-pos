import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

let ruta = '/terminos'
const cargarEstadoAcceso = vi.fn(() => Promise.resolve({
  autenticado: false, usuarioId: null, negocio: null, suscripcion: null, online: false, verificadoRemoto: false,
}))

vi.mock('next/navigation', () => ({ usePathname: () => ruta }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null }))
vi.mock('@/ui/sistema/Navegacion', () => ({ Navegacion: () => <nav>menú del POS</nav> }))
vi.mock('@/ui/cuenta/EstadoCuenta', () => ({ EstadoCuenta: () => null }))
vi.mock('@/datos/nube/acceso', () => ({
  EVENTO_ACCESO: 'libreta-acceso',
  accesoSaasObligatorio: () => true,
  cargarEstadoAcceso: () => cargarEstadoAcceso(),
  notificarCambioAcceso: () => undefined,
}))

import Terminos, { metadata as metadataTerminos } from '@/app/terminos/page'
import Privacidad, { metadata as metadataPrivacidad } from '@/app/privacidad/page'
import { ControlAcceso } from '@/ui/sistema/ControlAcceso'
import { PantallaAcceso } from '@/ui/sistema/PantallaAcceso'
import { PantallaCuenta } from '@/ui/cuenta/PantallaCuenta'

function titulos(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
}

describe('página de términos y condiciones', () => {
  it('tiene título, metadata y las secciones clave', () => {
    render(<Terminos />)
    expect(screen.getByRole('heading', { level: 1, name: /términos y condiciones/i })).toBeTruthy()
    expect(String(metadataTerminos.title)).toMatch(/términos/i)
    expect(metadataTerminos.description).toBeTruthy()
    const secciones = titulos().join(' | ')
    for (const clave of [/quién presta/i, /suscripción/i, /prueba/i, /falta de pago/i, /factura/i, /responsabilidad/i, /cambios/i, /ley aplicable/i]) {
      expect(secciones).toMatch(clave)
    }
    expect(screen.getByText(/28 de octubre de 2026/)).toBeTruthy()
    expect(document.body.textContent).toContain('[RAZÓN SOCIAL]')
    expect(document.body.textContent).toContain('[CUIT]')
    const aPrivacidad = screen.getAllByRole('link', { name: /política de privacidad/i })
    expect(aPrivacidad.length).toBeGreaterThan(0)
    expect(aPrivacidad.every((a) => a.getAttribute('href') === '/privacidad')).toBe(true)
  })
})

describe('página de política de privacidad', () => {
  it('tiene título, metadata y las secciones clave', () => {
    render(<Privacidad />)
    expect(screen.getByRole('heading', { level: 1, name: /política de privacidad/i })).toBeTruthy()
    expect(String(metadataPrivacidad.title)).toMatch(/privacidad/i)
    const secciones = titulos().join(' | ')
    for (const clave of [/qué datos/i, /tus clientes/i, /proveedores/i, /fuera de argentina/i, /tus derechos/i, /conservación/i, /seguridad/i, /cambios/i]) {
      expect(secciones).toMatch(clave)
    }
    const texto = document.body.textContent ?? ''
    expect(texto).toMatch(/Ley 25\.326/)
    expect(texto).toMatch(/encargad[oa] del tratamiento/i)
    expect(texto).toMatch(/Agencia de Acceso a la Información Pública/)
    expect(texto).toMatch(/Supabase/)
    expect(texto).toMatch(/Vercel/)
    expect(texto).toMatch(/OpenAI/)
    expect(texto).toMatch(/Estados Unidos/)
    expect(texto).toContain('[EMAIL DE CONTACTO]')
    expect(screen.getByText(/28 de octubre de 2026/)).toBeTruthy()
  })
})

describe('ControlAcceso con las páginas legales', () => {
  beforeEach(() => { cargarEstadoAcceso.mockClear() })

  it.each(['/terminos', '/privacidad'])('%s se abre sin sesión y sin el menú del POS', async (r) => {
    ruta = r
    render(<ControlAcceso><p>texto legal</p></ControlAcceso>)
    expect(screen.getByText('texto legal')).toBeTruthy()
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(screen.getByText('texto legal')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /entrar a mi negocio/i })).toBeNull()
    expect(screen.queryByText('menú del POS')).toBeNull()
  })

  it('el resto de las rutas sigue pidiendo acceso', async () => {
    ruta = '/vender'
    render(<ControlAcceso><p>caja</p></ControlAcceso>)
    expect(await screen.findByRole('button', { name: /entrar a mi negocio/i })).toBeTruthy()
    expect(screen.queryByText('caja')).toBeNull()
  })
})

describe('enlaces a las páginas legales', () => {
  it('la pantalla de acceso avisa que al entrar se aceptan los términos', () => {
    render(<PantallaAcceso />)
    const aviso = screen.getByText(/al entrar aceptás/i)
    expect(within(aviso).getByRole('link', { name: /términos/i }).getAttribute('href')).toBe('/terminos')
    expect(within(aviso).getByRole('link', { name: /política de privacidad/i }).getAttribute('href')).toBe('/privacidad')
  })

  it('la pantalla de cuenta tiene una sección con los dos documentos', () => {
    render(<PantallaCuenta />)
    const seccion = screen.getByRole('region', { name: /legales/i })
    expect(within(seccion).getByRole('link', { name: /términos y condiciones/i }).getAttribute('href')).toBe('/terminos')
    expect(within(seccion).getByRole('link', { name: /política de privacidad/i }).getAttribute('href')).toBe('/privacidad')
  })
})
