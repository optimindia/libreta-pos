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
import { IconoInicio, IconoVender, IconoPedidos, IconoFiados, IconoStock, IconoPlata, IconoHistorial, IconoConfig, IconoCuenta, IconoClientes, IconoMas, IconoNuevaVenta, IconoPorcentaje } from './iconos'
import { funcionActiva, type ClaveFuncion } from '@/dominio/funciones'
import { useFuncionesNegocio } from './usoFuncionesNegocio'

type Seccion = { href: string; texto: string; Icono: () => React.JSX.Element; funcion: ClaveFuncion | null }

// Inicio no depende de ninguna función: siempre está.
const SECCIONES: readonly Seccion[] = [
  { href: '/', texto: 'Inicio', Icono: IconoInicio, funcion: null },
  { href: '/vender', texto: 'Vender', Icono: IconoVender, funcion: 'vender' },
  { href: '/pedidos', texto: 'Pedidos', Icono: IconoPedidos, funcion: 'pedidos' },
  { href: '/fiados', texto: 'Fiados', Icono: IconoFiados, funcion: 'fiados' },
  { href: '/stock', texto: 'Stock', Icono: IconoStock, funcion: 'stock' },
  { href: '/plata', texto: 'Plata', Icono: IconoPlata, funcion: 'plata' },
]

const SECUNDARIAS: readonly Seccion[] = [
  { href: '/clientes', texto: 'Clientes', Icono: IconoClientes, funcion: 'clientes' },
  { href: '/operacion', texto: 'Control Pro', Icono: IconoPorcentaje, funcion: 'controlPro' },
  { href: '/cuenta', texto: 'Cuenta y suscripción', Icono: IconoCuenta, funcion: 'cuenta' },
  { href: '/historial', texto: 'Historial', Icono: IconoHistorial, funcion: 'historial' },
  { href: '/config', texto: 'Configuración', Icono: IconoConfig, funcion: 'configuracion' },
]

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
  const visible = (item: Seccion) => item.funcion === null || funcionActiva(funciones, item.funcion)
  const seccionesVisibles = SECCIONES.filter(visible)
  const secundariasVisibles = SECUNDARIAS.filter(visible)

  // En el celu: Inicio y Fiados a la izquierda, el botón de VENDER al centro,
  // Stock y Plata a la derecha, y "Más" con todo lo demás.
  const izquierda = seccionesVisibles.filter(({ href }) => href === '/' || href === '/fiados')
  const derecha = seccionesVisibles.filter(({ href }) => href === '/stock' || href === '/plata')
  const movilMas = [...seccionesVisibles.filter(({ href }) => href === '/pedidos'), ...secundariasVisibles]
  const hayVender = seccionesVisibles.some(({ href }) => href === '/vender')
  const masActivo = movilMas.some(({ href }) => esActiva(ruta, href))

  const enlace = ({ href, texto, Icono }: Seccion) => {
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

  const enlaceMovil = ({ href, texto, Icono }: Seccion) => (
    <Link key={href} href={href} aria-current={esActiva(ruta, href) ? 'page' : undefined} className="mz-nav-enlace">
      <Icono />
      <span>{texto}</span>
      {href === '/fiados' && fiadosAbiertos > 0 && <span className="mz-nav-insignia">{fiadosAbiertos}</span>}
    </Link>
  )

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
        <Link href="/vender" className="sidebar-new-sale" title="Nueva venta"><span className="sidebar-new-sale-icon"><IconoNuevaVenta /></span><span className="sidebar-label">Nueva venta</span></Link>
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

      <nav aria-label="Secciones principales" className="mz-nav">
        <div className="mz-nav-grupo">{izquierda.map(enlaceMovil)}</div>
        {hayVender ? (
          <Link href="/vender" className="mz-fab" aria-current={esActiva(ruta, '/vender') ? 'page' : undefined}>
            <span className="mz-fab-circulo"><IconoVender /></span>
            <span>Vender</span>
          </Link>
        ) : <span />}
        <div className="mz-nav-grupo">
          {derecha.map(enlaceMovil)}
          <div className="mz-nav-mas">
            <button
              type="button"
              className="mz-nav-enlace"
              aria-expanded={masAbierto}
              aria-haspopup="menu"
              data-activa={masActivo || masAbierto ? 'true' : 'false'}
              onClick={() => setMasAbierto((actual) => !actual)}
            >
              <IconoMas />
              <span>Más</span>
            </button>
            {masAbierto && (
              <div className="mz-nav-panel" role="menu" aria-label="Más secciones">
                {movilMas.map(({ href, texto, Icono }) => (
                  <Link key={href} href={href} role="menuitem" aria-current={esActiva(ruta, href) ? 'page' : undefined} onClick={() => setMasAbierto(false)}><Icono /><span>{texto}</span></Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
