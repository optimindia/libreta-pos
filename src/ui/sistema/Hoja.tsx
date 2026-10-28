'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconoCerrar } from './iconos'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Hoja que sube desde abajo en el celu y aparece centrada en la PC, como
 *  en una app nativa. Se cierra con Esc, tocando afuera, con la X o
 *  deslizando hacia abajo desde la manija. Mientras está abierta el foco no
 *  se escapa y el fondo no se mueve. */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}) {
  const idTitulo = useId()
  const panel = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    if (!abierta) return
    const anterior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        cerrar.current()
        return
      }
      if (evento.key !== 'Tab' || !panel.current) return
      const elementos = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (elementos.length === 0) return
      const primero = elementos[0]
      const ultimo = elementos[elementos.length - 1]
      if (evento.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
  }, [abierta])

  // Deslizar hacia abajo desde la manija o el título cierra la hoja.
  const arrastre = useRef<{ inicio: number; id: number } | null>(null)
  const empezar = (evento: React.PointerEvent) => {
    if (evento.pointerType === 'mouse') return
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

  if (!abierta) return null

  return (
    <div className="nb-hoja-capa" onPointerDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar() }}>
      <div ref={panel} className="nb-hoja" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <div className="nb-hoja-cabeza" onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <span className="nb-hoja-manija" aria-hidden="true" />
          <h2 id={idTitulo} className="nb-hoja-titulo">{titulo}</h2>
          <button type="button" className="nb-hoja-cerrar" aria-label="Cerrar" onClick={onCerrar}><IconoCerrar /></button>
        </div>
        <div className="nb-hoja-cuerpo">{children}</div>
      </div>
    </div>
  )
}
