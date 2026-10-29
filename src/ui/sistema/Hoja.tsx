'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconoCerrar } from './iconos'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Hojas abiertas, la última es la de arriba: sólo ella atiende Esc y Tab. */
const pila: symbol[] = []

/** Deja inertes (sin foco, sin lector de pantalla) todos los hermanos de la
 *  hoja y de sus ancestros: el fondo no existe mientras la hoja está abierta.
 *  Devuelve cómo deshacerlo. */
function aislarFondo(capa: HTMLElement): () => void {
  const marcados: HTMLElement[] = []
  for (let nodo: HTMLElement | null = capa; nodo && nodo !== document.body; nodo = nodo.parentElement) {
    for (const hermano of nodo.parentElement?.children ?? []) {
      if (hermano === nodo || !(hermano instanceof HTMLElement)) continue
      if (['SCRIPT', 'STYLE', 'LINK'].includes(hermano.tagName) || hermano.hasAttribute('inert')) continue
      hermano.setAttribute('inert', '')
      marcados.push(hermano)
    }
  }
  return () => marcados.forEach((elemento) => elemento.removeAttribute('inert'))
}

/** Hoja del sistema F (f/componentes.css): sube desde abajo en el celu y
 *  aparece centrada en la PC, como en una app nativa. Se cierra con Esc, tocando afuera, con la X o
 *  deslizando hacia abajo desde la manija. Mientras está abierta el foco no
 *  se escapa y el fondo no se mueve. */
export function Hoja(props: PropsHoja) {
  return props.abierta ? <HojaAbierta {...props} /> : null
}

type PropsHoja = {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  /** Algo al lado del título: el total en la hoja de cobro. */
  extra?: ReactNode
  /** En la PC, `angosto` deja la hoja en 480 px (cobro, precio). */
  ancho?: 'normal' | 'angosto'
  etiquetaCerrar?: string
  children: ReactNode
}

function HojaAbierta({
  onCerrar,
  titulo,
  extra,
  ancho = 'normal',
  etiquetaCerrar = 'Cerrar',
  children,
}: PropsHoja) {
  const idTitulo = useId()
  const panel = useRef<HTMLDivElement>(null)
  const capa = useRef<HTMLDivElement>(null)
  // Quién la abrió, leído antes de que un autoFocus de adentro le saque el
  // foco: es a donde vuelve al cerrar.
  const [apertura] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  const [yo] = useState(() => Symbol('hoja'))
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    pila.push(yo)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const liberarFondo = capa.current ? aislarFondo(capa.current) : () => {}
    // Si un campo ya tomó el foco (autoFocus), se lo deja: en la caja se
    // escribe el monto apenas se abre la hoja.
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()

    const tecla = (evento: KeyboardEvent) => {
      if (pila[pila.length - 1] !== yo) return
      if (evento.key === 'Escape') {
        evento.preventDefault()
        cerrar.current()
        return
      }
      if (evento.key !== 'Tab' || !panel.current) return
      const elementos = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (elementos.length === 0) {
        evento.preventDefault()
        panel.current.focus()
        return
      }
      const primero = elementos[0]
      const ultimo = elementos[elementos.length - 1]
      const activo = document.activeElement
      if (!panel.current.contains(activo)) {
        // El foco se escapó (un clic afuera, un cambio de pestaña): vuelve.
        evento.preventDefault()
        ;(evento.shiftKey ? ultimo : primero).focus()
      } else if (evento.shiftKey && (activo === primero || activo === panel.current)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      pila.splice(pila.indexOf(yo), 1)
      document.body.style.overflow = overflow
      liberarFondo()
      if (apertura?.isConnected) apertura.focus?.()
    }
  }, [apertura, yo])

  // Deslizar hacia abajo desde la manija o el título cierra la hoja.
  const arrastre = useRef<{ inicio: number; id: number } | null>(null)
  const empezar = (evento: React.PointerEvent) => {
    if (evento.pointerType === 'mouse') return
    // Tocar la X no es arrastrar: si se captura el puntero, el toque no
    // llega al botón.
    if ((evento.target as HTMLElement).closest('button')) return
    arrastre.current = { inicio: evento.clientY, id: evento.pointerId }
    ;(evento.currentTarget as HTMLElement).setPointerCapture?.(evento.pointerId)
  }
  const mover = (evento: React.PointerEvent) => {
    if (!arrastre.current || !panel.current) return
    const delta = Math.max(0, evento.clientY - arrastre.current.inicio)
    panel.current.style.transform = `translateY(${delta}px)`
  }
  const soltar = (evento: React.PointerEvent) => {
    if (!arrastre.current || !panel.current) return
    const delta = evento.clientY - arrastre.current.inicio
    arrastre.current = null
    panel.current.style.transform = ''
    if (delta > 90) cerrar.current()
  }

  return (
    <div ref={capa} className="f-hoja-capa" onPointerDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar() }}>
      <div ref={panel} className="f-hoja" data-ancho={ancho} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <div className="f-hoja-cabeza" onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <span className="f-hoja-manija" aria-hidden="true" />
          <h2 id={idTitulo} className="f-hoja-titulo">{titulo}</h2>
          {extra && <span className="f-hoja-extra">{extra}</span>}
          <button type="button" className="f-hoja-cerrar" aria-label={etiquetaCerrar} onClick={onCerrar}><IconoCerrar /></button>
        </div>
        <div className="f-hoja-cuerpo">{children}</div>
      </div>
    </div>
  )
}
