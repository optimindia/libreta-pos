'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { hayPendientes } from '@/datos/local/cola'
import { funcionActiva, type ClaveFuncion } from '@/dominio/funciones'
import { alternarOculta, armarMenu, FIJAS, MENU_INICIAL, mover, pestanasMovil, type IdSeccion } from '@/dominio/menu'
import { useFuncionesNegocio } from './usoFuncionesNegocio'
import { useMenu } from './usoMenu'
import { instalarApp, useInstalacion } from './instalacion'
import { aplicarTema, guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from './tema'
import { Hoja } from './Hoja'
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
  const opciones: { valor: PreferenciaTema; texto: string; Icono: () => React.JSX.Element }[] = [
    { valor: 'claro', texto: 'Claro', Icono: IconoSol },
    { valor: 'oscuro', texto: 'Oscuro', Icono: IconoLuna },
    { valor: 'auto', texto: 'Según la hora', Icono: IconoTemaAuto },
  ]
  return (
    <div className="nb-segmentos" role="radiogroup" aria-label="Colores de la pantalla">
      {opciones.map(({ valor, texto, Icono }) => (
        <button key={valor} type="button" role="radio" aria-checked={actual === valor} className="nb-segmento" onClick={() => elegir(valor)}>
          <Icono /><span>{texto}</span>
        </button>
      ))}
    </div>
  )
}

/* ───────────── Instalar la app ───────────── */

function InstalarApp({ compacta = false }: { compacta?: boolean }) {
  const estado = useInstalacion()
  const [ayudaIos, setAyudaIos] = useState(false)
  if (estado === 'instalada' || estado === 'no-disponible') return null

  return (
    <>
      <button
        type="button"
        className="nb-instalar"
        title={compacta ? 'Instalar Libreta' : undefined}
        aria-label={compacta ? 'Instalar Libreta' : undefined}
        onClick={() => (estado === 'ios' ? setAyudaIos(true) : void instalarApp())}
      >
        <IconoInstalar />
        <span className="nb-lateral-texto">Instalar Libreta</span>
      </button>
      <Hoja abierta={ayudaIos} onCerrar={() => setAyudaIos(false)} titulo="Instalar en tu iPhone">
        <ol className="nb-pasos">
          <li><span className="nb-paso-icono"><IconoCompartirIos /></span><span>Tocá <b>Compartir</b> en la barra de Safari.</span></li>
          <li><span className="nb-paso-icono"><IconoAgregarInicio /></span><span>Elegí <b>Agregar a inicio</b>.</span></li>
          <li><span className="nb-paso-icono"><IconoInicio /></span><span>Abrí Libreta desde el ícono, como cualquier app.</span></li>
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
      <p className="nb-hoja-ayuda">Elegí qué secciones ves y en qué orden. En el celu, las dos primeras van en la barra de abajo.</p>
      <ul className="nb-editor">
        {FIJAS.filter(disponible).map((id) => {
          const { texto, Icono } = SECCIONES[id]
          return (
            <li key={id} className="nb-editor-fila" data-fija="true">
              <span className="nb-editor-icono"><Icono /></span>
              <span className="nb-editor-nombre">{texto}<small>Siempre visible</small></span>
            </li>
          )
        })}
        {movibles.map((id, indice) => {
          const { texto, Icono } = SECCIONES[id]
          const oculta = menu.ocultas.includes(id)
          return (
            <li key={id} className="nb-editor-fila" data-oculta={oculta ? 'true' : 'false'}>
              <span className="nb-editor-icono"><Icono /></span>
              <span className="nb-editor-nombre">{texto}{oculta && <small>Oculta</small>}</span>
              <span className="nb-editor-acciones">
                <button type="button" className="nb-icono-boton" aria-label={`Subir ${texto}`} disabled={indice === 0} onClick={() => cambiar((actual) => mover(actual, id, -1))}><IconoArriba /></button>
                <button type="button" className="nb-icono-boton" aria-label={`Bajar ${texto}`} disabled={indice === movibles.length - 1} onClick={() => cambiar((actual) => mover(actual, id, 1))}><IconoAbajo /></button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!oculta}
                  aria-label={`Mostrar ${texto} en el menú`}
                  className="nb-interruptor"
                  onClick={() => cambiar((actual) => alternarOculta(actual, id))}
                >
                  {oculta ? <IconoOculto /> : <IconoVisible />}
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      <button type="button" className="nb-fila-accion" onClick={() => cambiar((actual) => ({ ...MENU_INICIAL, compacta: actual.compacta }))}>
        <IconoRestablecer /><span>Volver al menú de fábrica</span>
      </button>
    </Hoja>
  )
}

/* ───────────── Navegación ───────────── */

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
    return funcion === null || funcionActiva(funciones, funcion)
  }
  const { visibles } = armarMenu(menu, disponible)
  const pestanas = pestanasMovil(visibles)
  const enHoja = visibles.filter((id) => id !== 'inicio' && id !== 'vender' && !pestanas.includes(id))
  const hayVender = visibles.includes('vender')
  const masActivo = enHoja.some((id) => esActiva(ruta, SECCIONES[id].href))
  const nombre = negocio?.nombre?.trim() || 'Tu almacén'
  const compacta = menu.compacta

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
    id === 'fiados' && fiadosAbiertos > 0 ? <span className="nb-insignia" aria-label={`${fiadosAbiertos} con deuda`}>{fiadosAbiertos}</span> : null

  return (
    <>
      <aside className="nb-lateral" data-compacta={compacta ? 'true' : 'false'} aria-label="Menú de Libreta">
        <div className="nb-lateral-marca">
          <span className="nb-logo" aria-hidden="true">L</span>
          <span className="nb-lateral-texto nb-lateral-negocio"><strong>{nombre}</strong><small>Libreta</small></span>
          <button
            type="button"
            className="nb-icono-boton nb-plegar"
            aria-label={compacta ? 'Agrandar menú' : 'Achicar menú'}
            title={`${compacta ? 'Agrandar' : 'Achicar'} menú (Ctrl+B)`}
            onClick={() => cambiarMenu((actual) => ({ ...actual, compacta: !actual.compacta }))}
          >
            {compacta ? <IconoDesplegar /> : <IconoPlegar />}
          </button>
        </div>

        {hayVender && (
          <Link href="/vender" className="nb-lateral-vender" aria-current={esActiva(ruta, '/vender') ? 'page' : undefined} data-tip="Vender">
            <IconoVender /><span className="nb-lateral-texto">Vender</span>
          </Link>
        )}

        <nav className="nb-lateral-lista" aria-label="Secciones">
          {visibles.filter((id) => id !== 'vender').map((id) => {
            const { href, texto, Icono } = SECCIONES[id]
            return (
              <Link key={id} href={href} className="nb-lateral-enlace" aria-current={esActiva(ruta, href) ? 'page' : undefined} data-tip={texto}>
                <Icono /><span className="nb-lateral-texto">{texto}</span>{insignia(id)}
              </Link>
            )
          })}
        </nav>

        <div className="nb-lateral-pie">
          <InstalarApp compacta={compacta} />
          <button type="button" className="nb-lateral-enlace" onClick={() => setEditor(true)} data-tip="Editar menú" aria-label={compacta ? 'Editar menú' : undefined}>
            <IconoEditarMenu /><span className="nb-lateral-texto">Editar menú</span>
          </button>
          <span className="nb-estado" data-pendiente={pendientes ? 'true' : 'false'}>
            <span className="nb-estado-punto" aria-hidden="true" />
            <span className="nb-lateral-texto">{pendientes ? 'Guardado, falta subir' : 'Todo al día'}</span>
          </span>
        </div>
      </aside>

      <nav className="nb-barra" aria-label="Secciones principales">
        <BotonPestana id="inicio" ruta={ruta} insignia={null} />
        {pestanas[0] ? <BotonPestana id={pestanas[0]} ruta={ruta} insignia={insignia(pestanas[0])} /> : <span />}
        {hayVender ? (
          <Link href="/vender" className="nb-barra-vender" aria-current={esActiva(ruta, '/vender') ? 'page' : undefined}>
            <span className="nb-barra-vender-circulo"><IconoVender /></span>
            <span>Vender</span>
          </Link>
        ) : <span />}
        {pestanas[1] ? <BotonPestana id={pestanas[1]} ruta={ruta} insignia={insignia(pestanas[1])} /> : <span />}
        <button
          type="button"
          className="nb-pestana"
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
          <div className="nb-hoja-grilla">
            {enHoja.map((id) => {
              const { href, texto, Icono } = SECCIONES[id]
              return (
                <Link key={id} href={href} className="nb-hoja-tile" aria-current={esActiva(ruta, href) ? 'page' : undefined} onClick={() => setHojaMas(false)}>
                  <span className="nb-hoja-tile-icono"><Icono /></span><span>{texto}</span>{insignia(id)}
                </Link>
              )
            })}
          </div>
        )}
        <h3 className="nb-hoja-subtitulo">Colores</h3>
        <SelectorTema />
        <div className="nb-hoja-filas">
          <button type="button" className="nb-fila-accion" onClick={() => { setHojaMas(false); setEditor(true) }}>
            <IconoEditarMenu /><span>Editar menú</span>
          </button>
          <InstalarApp />
        </div>
      </Hoja>

      <EditorMenu abierto={editor} onCerrar={() => setEditor(false)} disponible={disponible} />
    </>
  )
}

function BotonPestana({ id, ruta, insignia }: { id: IdSeccion; ruta: string; insignia: React.ReactNode }) {
  const { href, texto, Icono } = SECCIONES[id]
  return (
    <Link href={href} className="nb-pestana" aria-current={esActiva(ruta, href) ? 'page' : undefined}>
      <Icono /><span>{texto}</span>{insignia}
    </Link>
  )
}
