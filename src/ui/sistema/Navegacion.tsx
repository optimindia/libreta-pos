'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { hayPendientes } from '@/datos/local/cola'
import { ChipEstado } from './ChipEstado'
import { EstadoConexion } from './EstadoConexion'
import { IconoVender, IconoPedidos, IconoFiados, IconoStock, IconoPlata, IconoHistorial, IconoConfig, IconoCuenta, IconoClientes, IconoMas, IconoNuevaVenta, IconoPorcentaje } from './iconos'
import { funcionActiva, type ClaveFuncion } from '@/dominio/funciones'
import { useFuncionesNegocio } from './usoFuncionesNegocio'

const SECCIONES = [
  { href: '/', texto: 'Vender', Icono: IconoVender, funcion: 'vender' },
  { href: '/pedidos', texto: 'Pedidos', Icono: IconoPedidos, funcion: 'pedidos' },
  { href: '/fiados', texto: 'Fiados', Icono: IconoFiados, funcion: 'fiados' },
  { href: '/stock', texto: 'Stock', Icono: IconoStock, funcion: 'stock' },
  { href: '/plata', texto: 'Plata', Icono: IconoPlata, funcion: 'plata' },
] as const

const SECUNDARIAS = [
  { href: '/clientes', texto: 'Clientes', Icono: IconoClientes, funcion: 'clientes' },
  { href: '/operacion', texto: 'Control Pro', Icono: IconoPorcentaje, funcion: 'controlPro' },
  { href: '/cuenta', texto: 'Cuenta y suscripción', Icono: IconoCuenta, funcion: 'cuenta' },
  { href: '/historial', texto: 'Historial', Icono: IconoHistorial, funcion: 'historial' },
  { href: '/config', texto: 'Configuración', Icono: IconoConfig, funcion: 'configuracion' },
] as const

function esActiva(ruta: string, href: string): boolean {
  return href === '/' ? ruta === '/' : ruta.startsWith(href)
}

export function Navegacion() {
  const ruta = usePathname()
  const [masAbierto, setMasAbierto] = useState(false)
  const { funciones } = useFuncionesNegocio()
  // Cuenta los que siguen debiendo, no todos los anotados alguna vez.
  const fiadosAbiertos = useLiveQuery(
    async () => (await repos.fiados.abiertos()).length,
    [],
    0,
  )
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const pendientes = useLiveQuery(() => hayPendientes(), [], false)
  const nombre = negocio?.nombre?.trim() || 'Tu almacén'
  const inicial = nombre.charAt(0).toUpperCase()
  const seccionesVisibles = SECCIONES.filter((item) => funcionActiva(funciones, item.funcion as ClaveFuncion))
  const secundariasVisibles = SECUNDARIAS.filter((item) => funcionActiva(funciones, item.funcion as ClaveFuncion))
  const movilPrincipales = seccionesVisibles.slice(0, 4)
  const movilMas = [...seccionesVisibles.slice(4), ...secundariasVisibles]

  const enlace = ({ href, texto, Icono }: (typeof SECCIONES[number] | typeof SECUNDARIAS[number])) => {
    const activa = esActiva(ruta, href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={activa ? 'page' : undefined}
        title={texto}
        className="sidebar-link"
        data-active={activa ? 'true' : 'false'}
      >
        <span className="sidebar-icon"><Icono /></span>
        <span className="sidebar-label">{texto}</span>
        {href === '/fiados' && fiadosAbiertos > 0 && <span className="sidebar-badge">{fiadosAbiertos}</span>}
      </Link>
    )
  }

  return (
    <>
      <aside className="desktop-sidebar" aria-label="Navegación de Libreta">
        <div className="sidebar-brand">
          <span className="sidebar-mark">L</span>
          <span className="sidebar-brand-copy"><strong>Libreta</strong><small>POS de barrio</small></span>
        </div>
        <div className="sidebar-business">
          <span className="sidebar-business-avatar">{inicial}</span>
          <span className="sidebar-business-copy"><strong>{nombre}</strong><small>Panel de operación</small></span>
        </div>
        <Link href="/" className="sidebar-new-sale" title="Nueva venta"><span className="sidebar-new-sale-icon"><IconoNuevaVenta /></span><span className="sidebar-label">Nueva venta</span></Link>
        <div className="sidebar-section-label">Operación</div>
        <nav className="sidebar-menu" aria-label="Secciones principales">
          {seccionesVisibles.map(enlace)}
        </nav>
        <div className="sidebar-section-label sidebar-secondary-label">Gestión</div>
        <nav className="sidebar-menu" aria-label="Gestión del negocio">
          {secundariasVisibles.map(enlace)}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status"><ChipEstado pendientes={pendientes} /><EstadoConexion /></div>
          <p>Todo anotado, siempre.</p>
        </div>
      </aside>

      <nav aria-label="Secciones principales" className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {movilPrincipales.map(({ href, texto, Icono }) => {
            const activa = esActiva(ruta, href)
            return <Link key={href} href={href} aria-current={activa ? 'page' : undefined} className="mobile-nav-link" style={{ color: activa ? 'var(--verde)' : 'var(--tenue)' }}><Icono /><span className={activa ? 'font-bold' : ''}>{texto}</span>{href === '/fiados' && fiadosAbiertos > 0 && <span className="mobile-nav-badge">{fiadosAbiertos}</span>}</Link>
          })}
          <div className="mobile-more-wrap">
            <button
              type="button"
              className="mobile-nav-link"
              aria-expanded={masAbierto}
              aria-haspopup="menu"
              style={{ color: movilMas.some(({ href }) => esActiva(ruta, href)) || masAbierto ? 'var(--verde)' : 'var(--tenue)' }}
              onClick={() => setMasAbierto((actual) => !actual)}
            >
              <IconoMas />
              <span className={masAbierto || movilMas.some(({ href }) => esActiva(ruta, href)) ? 'font-bold' : ''}>Más</span>
            </button>
            {masAbierto && (
              <div className="mobile-more-panel" role="menu" aria-label="Más secciones">
                {movilMas.map(({ href, texto, Icono }) => {
                  const activa = esActiva(ruta, href)
                  return <Link key={href} href={href} role="menuitem" className="mobile-more-link" aria-current={activa ? 'page' : undefined} onClick={() => setMasAbierto(false)}><Icono /><span>{texto}</span></Link>
                })}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
