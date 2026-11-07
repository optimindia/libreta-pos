'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { buscarEnTodo, type SeccionBuscable, type TipoResultado } from '@/dominio/buscador'
import { formatearPesos } from '@/dominio/dinero'
import { deudaPorCliente } from '@/dominio/fiado'
import { Hoja } from './Hoja'
import { irA } from './destino'
import { IconoBuscar, IconoClientes, IconoProveedor, IconoStock } from './iconos'

export const EVENTO_ABRIR_BUSCADOR = 'libreta:abrir-buscador'

export function abrirBuscador(): void {
  window.dispatchEvent(new Event(EVENTO_ABRIR_BUSCADOR))
}

const TITULO: Record<TipoResultado, string> = {
  seccion: 'Secciones',
  producto: 'Productos',
  cliente: 'Clientes',
  proveedor: 'Proveedores',
}

function IconoDe({ tipo }: { tipo: TipoResultado }) {
  if (tipo === 'producto') return <IconoStock />
  if (tipo === 'cliente') return <IconoClientes />
  if (tipo === 'proveedor') return <IconoProveedor />
  return <IconoBuscar />
}

/** Buscar productos, clientes, proveedores o secciones desde cualquier
 *  pantalla: Ctrl+K (o Cmd+K) en la PC, o el botón Buscar. */
export function BuscadorGeneral({ secciones, conProveedores }: { secciones: SeccionBuscable[]; conProveedores: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const abrir = () => { setTexto(''); setAbierto(true) }
    const tecla = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        abrir()
      }
    }
    window.addEventListener(EVENTO_ABRIR_BUSCADOR, abrir)
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener(EVENTO_ABRIR_BUSCADOR, abrir)
      window.removeEventListener('keydown', tecla)
    }
  }, [])

  const datos = useLiveQuery(async () => {
    if (!abierto) return null
    const [productos, clientes, proveedores, fiados, pagos] = await Promise.all([
      repos.productos.todos(),
      repos.clientes.todos(),
      conProveedores ? repos.proveedores.todos() : Promise.resolve([]),
      db.fiados.toArray(),
      repos.fiados.pagos(),
    ])
    const deudas = new Map(deudaPorCliente(fiados, pagos, Date.now()).map((deuda) => [deuda.clienteId as string, deuda.saldo]))
    return { productos, clientes, proveedores, deudas }
  }, [abierto, conProveedores], null)

  const grupos = useMemo(() => datos
    ? buscarEnTodo(texto, { secciones, ...datos, formatearPesos })
    : [], [texto, datos, secciones])
  const primero = grupos[0]?.resultados[0]

  function elegir(href: string) {
    setAbierto(false)
    irA((destino) => router.push(destino), href)
  }

  function teclaEnCampo(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' && primero) {
      evento.preventDefault()
      elegir(primero.href)
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      lista.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }

  function teclaEnLista(evento: React.KeyboardEvent<HTMLUListElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    const botones = [...(lista.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
    if (actual < 0) return
    evento.preventDefault()
    const siguiente = evento.key === 'ArrowDown' ? actual + 1 : actual - 1
    if (siguiente < 0) document.getElementById('buscador-general')?.focus()
    else botones[Math.min(siguiente, botones.length - 1)]?.focus()
  }

  return (
    <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Buscar">
      <div className="f-buscador">
        <label className="f-buscador-campo">
          <IconoBuscar />
          <span className="f-sr">Buscar en todo Libreta</span>
          <input
            id="buscador-general"
            type="search"
            autoFocus
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Producto, código, cliente, teléfono…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={teclaEnCampo}
          />
        </label>

        {texto.trim() === '' ? (
          <p className="f-buscador-ayuda">Escribí un nombre, un código de barras o un teléfono. <span className="f-buscador-atajo">En la PC: <kbd>Ctrl</kbd> + <kbd>K</kbd></span></p>
        ) : grupos.length === 0 ? (
          <p className="f-buscador-ayuda" role="status">No encontramos nada con «{texto.trim()}».</p>
        ) : (
          <ul className="f-buscador-grupos" ref={lista} onKeyDown={teclaEnLista}>
            {grupos.map((grupo) => (
              <li key={grupo.tipo}>
                <h3 className="f-buscador-grupo">{TITULO[grupo.tipo]}</h3>
                <ul className="f-buscador-resultados">
                  {grupo.resultados.map((resultado) => (
                    <li key={`${resultado.tipo}-${resultado.id}`}>
                      <button type="button" className="f-buscador-resultado" onClick={() => elegir(resultado.href)}>
                        <span className="f-buscador-icono" aria-hidden="true"><IconoDe tipo={resultado.tipo} /></span>
                        <span className="f-buscador-textos">
                          <span className="f-buscador-titulo">{resultado.titulo}</span>
                          <span className="f-buscador-detalle">{resultado.detalle}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  )
}
