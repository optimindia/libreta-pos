'use client'

import { useRef, type ReactNode } from 'react'

export type OpcionSegmentado<T extends string> = {
  valor: T
  /** Lo que se ve. */
  texto: ReactNode
  /** Nombre accesible si el texto visible es una abreviatura ("Transf."). */
  nombre?: string
  /** `cuidado` pinta la opción en coral (por ejemplo, Fiado). */
  tono?: 'cuidado'
}

/** Elegir una opción entre pocas (Cómo paga, Claro/Oscuro). Es un
 *  radiogroup: con las flechas se pasa de una a otra, como en una app. */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  className = '',
}: {
  etiqueta: string
  opciones: OpcionSegmentado<T>[]
  valor: T
  onCambiar: (valor: T) => void
  className?: string
}) {
  const grupo = useRef<HTMLDivElement>(null)

  const teclas = (evento: React.KeyboardEvent) => {
    const paso = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? -1 : 0
    if (paso === 0) return
    evento.preventDefault()
    const actual = Math.max(0, opciones.findIndex((opcion) => opcion.valor === valor))
    const siguiente = opciones[(actual + paso + opciones.length) % opciones.length]
    onCambiar(siguiente.valor)
    grupo.current?.querySelector<HTMLButtonElement>(`[data-valor="${siguiente.valor}"]`)?.focus()
  }

  const hayElegida = opciones.some((opcion) => opcion.valor === valor)

  return (
    <div ref={grupo} className={`f-segmentado ${className}`.trim()} role="radiogroup" aria-label={etiqueta} onKeyDown={teclas}>
      {opciones.map((opcion, indice) => {
        const elegida = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            aria-label={opcion.nombre}
            tabIndex={elegida || (!hayElegida && indice === 0) ? 0 : -1}
            data-valor={opcion.valor}
            data-tono={opcion.tono}
            className="f-segmento"
            onClick={() => onCambiar(opcion.valor)}
          >
            {opcion.texto}
          </button>
        )
      })}
    </div>
  )
}
