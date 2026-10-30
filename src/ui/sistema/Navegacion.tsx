'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { hayPendientes } from '@/datos/local/cola'
import { funcionActiva, type ClaveFuncion } from '@/dominio/funciones'
import { rolDe, seccionPermitida } from '@/dominio/roles'
import { alternarOculta, armarMenu, FIJAS, MENU_INICIAL, mover, pestanasMovil, type IdSeccion } from '@/dominio/menu'
import { useFuncionesNegocio } from './usoFuncionesNegocio'
import { useMenu } from './usoMenu'
import { instalarApp, useInstalacion } from './instalacion'
import { aplicarTema, guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from './tema'
import { Hoja } from './Hoja'
import { CerrarSesion } from './CerrarSesion'
import { Segmentado } from './Segmentado'
import {
  IconoAgregarInicio, IconoAbajo, IconoClientes, IconoCompartirIos, IconoConfig, IconoCuenta, IconoDesplegar,
  IconoEditarMenu, IconoFiados, IconoHistorial, IconoInicio, IconoInstalar, IconoLuna, IconoMas, IconoOculto,
  IconoPedidos, IconoPlata, IconoPlegar, IconoPorcentaje, IconoRestablecer, IconoSol, IconoStock, IconoArriba,
  IconoTemaAuto, IconoVender, IconoVisible,
} from './iconos'

type Seccion = { href: string; texto: string; Icono: () => React.JSX.Element; funcion: ClaveFuncion | null }

export const SECCIONES: Record<IdSeccion, Seccion> = {
  inicio: { href: '/', texto: 'Inicio', Icono: IconoInicio, funcion: null },
  vender: { href: '/vender', texto: 'Vender', Icono: IconoVender, funcion: 'vender' },
  fiados: { href: '/fiados', texto: 'Fiados', Icono: IconoFiados, funcion: 'fiados' },
  stock: { href: '/stock', texto: 'Stock', Icono: IconoStock, funcion: 'stock' },
  plata: { href: '/plata', texto: 'Plata', Icono: IconoPlata, funcion: 'plata' },
  pedidos: { href: '/pedidos', texto: 'Pedidos', Icono: IconoPedidos, funcion: 'pedidos' },
  clientes: { href: '/clientes', texto: 'Clientes', Icono: IconoClientes, funcion: 'clientes' },
  historial: { href: '/historial', texto: 'Historial', Icono: IconoHistorial, funcion: 'historial' },
  operacion: { href: '/operacion', texto: 'Control Pro', Icono: IconoPorcentaje, funcion: 'controlPro' },
  config: { href: '/config', texto: 'Ajustes', Icono: IconoConfig, funcion: 'configuracion' },
  cuenta: { href: '/cuenta', texto: 'Mi cuenta', Icono: IconoCuenta, funcion: 'cuenta' },
}

function esActiva(ruta: string, href: string): boolean {
  return href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(`${href}/`)
}

/* ───────────── Tema (claro / oscuro / automático) ───────────── */

const EVENTO_TEMA = 'libreta-tema-cambio'
function suscribirTema(avisar: () => void) {
  window.addEventListener(EVENTO_TEMA, avisar)
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO_TEMA, avisar)
    window.removeEventListener('storage', avisar)
  }
}

function SelectorTema() {
  const actual = useSyncExternalStore(suscribirTema, leerPreferenciaTema, () => 'auto' as PreferenciaTema)
  const elegir = (preferencia: PreferenciaTema) => {
    guardarPreferenciaTema(preferencia)
    aplicarTema(preferencia)
    window.dispatchEvent(new Event(EVENTO_TEMA))
  }
  return (
    <Segmentado<PreferenciaTema>
      etiqueta="Colores de la pantalla"
      valor={actual}
      onCambiar={elegir}
      opciones={[
        { valor: 'claro', texto: <><IconoSol /><span>Claro</span></> },
        { valor: 'oscuro', texto: <><IconoLuna /><span>Oscuro</span></> },
        { valor: 'auto', texto: <><IconoTemaAuto /><span>Según la hora</span></> },
      ]}
    />
  )
}

/* ───────────── Instalar la app ───────────── */

function InstalarApp({ estilo }: { estilo: 'lateral' | 'fila' }) {
  const estado = useInstalacion()
  const [ayudaIos, setAyudaIos] = useState(false)
  if (estado === 'instalada' || estado === 'no-disponible') return null

  return (
    <>
      <button
        type="button"
        className={estilo === 'lateral' ? 'f-nav-item' : 'f-fila-accion'}
        aria-label={estilo === 'lateral' ? 'Instalar Libreta' : undefined}
        data-tip="Instalar Libreta"
        onClick={() => (estado === 'ios' ? setAyudaIos(true) : void instalarApp())}
      >
        <span className="f-nav-icono"><IconoInstalar /></span>
        <span className="f-nav-texto">{estilo === 'lateral' ? 'Instalar' : 'Instalar Libreta'}</span>
      </button>
      <Hoja abierta={ayudaIos} onCerrar={() => setAyudaIos(false)} titulo="Instalar en tu iPhone">
        <ol className="f-pasos">
          <li><span className="f-paso-icono"><IconoCompartirIos /></span><span>Tocá <b>Compartir</b> en la barra de Safari.</span></li>
          <li><span className="f-paso-icono"><IconoAgregarInicio /></span><span>Elegí <b>Agregar a inicio</b>.</span></li>
          <li><span className="f-paso-icono"><IconoInicio /></span><span>Abrí Libreta desde el ícono, como cualquier app.</span></li>
        </ol>
      </Hoja>
    </>
  )
}

/* ───────────── Editor del menú ───────────── */

function EditorMenu({ abierto, onCerrar, disponible }: { abierto: boolean; onCerrar: () => void; disponible: (id: IdSeccion) => boolean }) {
  const [menu, cambiar] = useMenu()
  const movibles = menu.orden.filter(disponible)

  return (
    <Hoja abierta={abierto} onCerrar={onCerrar} titulo="Editar menú">
      <p className="f-hoja-ayuda">Elegí qué secciones ves y en qué orden. En el celu, las dos primeras van en la barra de abajo.</p>
      <ul className="f-editor">
        {FIJAS.filter(disponible).map((id) => {
          const { texto, Icono } = SECCIONES[id]
          return (
            <li key={id} className="f-editor-fila" data-fija="true">
              <span className="f-editor-icono"><Icono /></span>
              <span className="f-editor-nombre">{texto}<small>Siempre visible</small></span>
            </li>
          )
        })}
        {movibles.map((id, indice) => {
          const { texto, Icono } = SECCIONES[id]
          const oculta = menu.ocultas.includes(id)
          return (
            <li key={id} className="f-editor-fila" data-oculta={oculta ? 'true' : 'false'}>
              <span className="f-editor-icono"><Icono /></span>
              <span className="f-editor-nombre">{texto}{oculta && <small>Oculta</small>}</span>
              <span className="f-editor-acciones">
                <button type="button" className="f-icono-boton" aria-label={`Subir ${texto}`} disabled={indice === 0} onClick={() => cambiar((actual) => mover(actual, id, -1))}><IconoArriba /></button>
                <button type="button" className="f-icono-boton" aria-label={`Bajar ${texto}`} disabled={indice === movibles.length - 1} onClick={() => cambiar((actual) => mover(actual, id, 1))}><IconoAbajo /></button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!oculta}
                  aria-label={`Mostrar ${texto} en el menú`}
                  className="f-icono-boton f-interruptor"
                  onClick={() => cambiar((actual) => alternarOculta(actual, id))}
                >
                  {oculta ? <IconoOculto /> : <IconoVisible />}
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      <button type="button" className="f-fila-accion" onClick={() => cambiar((actual) => ({ ...MENU_INICIAL, compacta: actual.compacta }))}>
        <span className="f-nav-icono"><IconoRestablecer /></span><span>Volver al menú de fábrica</span>
      </button>
    </Hoja>
  )
}

/* ───────────── Navegación ───────────── */

/** PC: barra lateral oscura de 96 px (ícono arriba, nombre abajo; la
 *  compacta, de 72 px, sólo con íconos). Celu: barra oscura abajo con
 *  Inicio, dos secciones, VENDER al centro en lima y Más. Estilos en
 *  f/navegacion.css. */
export function Navegacion() {
  const ruta = usePathname()
  const [hojaMas, setHojaMas] = useState(false)
  const [editor, setEditor] = useState(false)
  const [menu, cambiarMenu] = useMenu()
  const { funciones } = useFuncionesNegocio()
  // Cuenta los que siguen debiendo, no todos los anotados alguna vez.
  const fiadosAbiertos = useLiveQuery(async () => (await repos.fiados.abiertos()).length, [], 0)
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const pendientes = useLiveQuery(() => hayPendientes(), [], false)

  const disponible = (id: IdSeccion) => {
    const { funcion } = SECCIONES[id]
    if (!seccionPermitida(rolDe(negocio?.rol), id)) return false
    return funcion === null || funcionActiva(funciones, funcion)
  }
  const { visibles } = armarMenu(menu, disponible)
  const pestanas = pestanasMovil(visibles)
  const enHoja = visibles.filter((id) => id !== 'inicio' && id !== 'vender' && !pestanas.includes(id))
  const hayVender = visibles.includes('vender')
  const masActivo = enHoja.some((id) => esActiva(ruta, SECCIONES[id].href))
  const nombre = negocio?.nombre?.trim() || 'Tu almacén'
  const compacta = menu.compacta
  // Sólo hay sesión que cerrar si el aparato está vinculado a una cuenta.
  const conCuenta = Boolean(negocio?.negocioId)

  // Ctrl/Cmd + B achica o agranda la barra lateral, como en un programa de PC.
  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && evento.key.toLowerCase() === 'b') {
        if (!window.matchMedia('(min-width: 900px)').matches) return
        evento.preventDefault()
        cambiarMenu((actual) => ({ ...actual, compacta: !actual.compacta }))
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [cambiarMenu])

  // La barra lateral ocupa lugar: el contenido se corre según su ancho.
  useEffect(() => {
    document.documentElement.dataset.lateral = compacta ? 'compacta' : 'amplia'
  }, [compacta])

  const insignia = (id: IdSeccion) =>
    id === 'fiados' && fiadosAbiertos > 0 ? <span className="f-insignia" aria-label={`${fiadosAbiertos} con deuda`}>{fiadosAbiertos}</span> : null

  return (
    <>
      <aside className="f-lateral" data-compacta={compacta ? 'true' : 'false'} aria-label="Menú de Libreta">
        <div className="f-lateral-marca" title={nombre}>
          <span className="f-logo" aria-hidden="true">L</span>
          <span className="f-sr">{nombre}</span>
        </div>

        <nav className="f-lateral-lista" aria-label="Secciones">
          {visibles.map((id) => {
            const { href, texto, Icono } = SECCIONES[id]
            return (
              <Link key={id} href={href} className="f-nav-item" aria-current={esActiva(ruta, href) ? 'page' : undefined} aria-label={compacta ? texto : undefined} data-tip={texto}>
                <span className="f-nav-icono"><Icono /></span><span className="f-nav-texto">{texto}</span>{insignia(id)}
              </Link>
            )
          })}
        </nav>

        <div className="f-lateral-pie">
          <InstalarApp estilo="lateral" />
          {conCuenta && <CerrarSesion estilo="lateral" />}
          <div className="f-lateral-herramientas">
            <button type="button" className="f-nav-mini" onClick={() => setEditor(true)} aria-label="Editar menú" title="Editar menú">
              <IconoEditarMenu />
            </button>
            <button
              type="button"
              className="f-nav-mini"
              aria-label={compacta ? 'Agrandar menú' : 'Achicar menú'}
              title={`${compacta ? 'Agrandar' : 'Achicar'} menú (Ctrl+B)`}
              onClick={() => cambiarMenu((actual) => ({ ...actual, compacta: !actual.compacta }))}
            >
              {compacta ? <IconoDesplegar /> : <IconoPlegar />}
            </button>
          </div>
          <span className="f-guardado" data-pendiente={pendientes ? 'true' : 'false'} title={pendientes ? 'Guardado en este aparato, falta subir' : 'Todo guardado y al día'}>
            <span className="f-guardado-punto" aria-hidden="true" />
            <span className="f-nav-texto">{pendientes ? 'Sin subir' : 'Guardado'}</span>
          </span>
        </div>
      </aside>

      <nav className="f-barra" aria-label="Secciones principales">
        <BotonPestana id="inicio" ruta={ruta} insignia={null} />
        {pestanas[0] ? <BotonPestana id={pestanas[0]} ruta={ruta} insignia={insignia(pestanas[0])} /> : <span />}
        {hayVender ? (
          <Link href="/vender" className="f-barra-vender" aria-label="Vender" aria-current={esActiva(ruta, '/vender') ? 'page' : undefined}>
            <span className="f-barra-vender-boton"><IconoVender /></span>
          </Link>
        ) : <span />}
        {pestanas[1] ? <BotonPestana id={pestanas[1]} ruta={ruta} insignia={insignia(pestanas[1])} /> : <span />}
        <button
          type="button"
          className="f-barra-item"
          aria-haspopup="dialog"
          aria-expanded={hojaMas}
          data-activa={masActivo ? 'true' : 'false'}
          onClick={() => setHojaMas(true)}
        >
          <IconoMas /><span>Más</span>
        </button>
      </nav>

      <Hoja abierta={hojaMas} onCerrar={() => setHojaMas(false)} titulo="Más secciones">
        {enHoja.length > 0 && (
          <div className="f-mas-grilla">
            {enHoja.map((id) => {
              const { href, texto, Icono } = SECCIONES[id]
              return (
                <Link key={id} href={href} className="f-mas-item" aria-current={esActiva(ruta, href) ? 'page' : undefined} onClick={() => setHojaMas(false)}>
                  <span className="f-mas-icono"><Icono /></span><span>{texto}</span>{insignia(id)}
                </Link>
              )
            })}
          </div>
        )}
        <h3 className="f-hoja-subtitulo">Colores</h3>
        <SelectorTema />
        <div className="f-filas">
          <button type="button" className="f-fila-accion" onClick={() => { setHojaMas(false); setEditor(true) }}>
            <span className="f-nav-icono"><IconoEditarMenu /></span><span>Editar menú</span>
          </button>
          <InstalarApp estilo="fila" />
          {conCuenta && <CerrarSesion estilo="fila" />}
        </div>
      </Hoja>

      <EditorMenu abierto={editor} onCerrar={() => setEditor(false)} disponible={disponible} />
    </>
  )
}

function BotonPestana({ id, ruta, insignia }: { id: IdSeccion; ruta: string; insignia: React.ReactNode }) {
  const { href, texto, Icono } = SECCIONES[id]
  return (
    <Link href={href} className="f-barra-item" aria-current={esActiva(ruta, href) ? 'page' : undefined}>
      <Icono /><span>{texto}</span>{insignia}
    </Link>
  )
}
