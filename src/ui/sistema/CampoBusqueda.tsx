'use client'

import type { ReactNode } from 'react'
import { IconoBuscar } from './iconos'

/** Buscador con lupa. `grande` (60 px) es el de la caja en la PC. */
export function CampoBusqueda({
  etiqueta,
  valor,
  onCambiar,
  tamano = 'normal',
  atajo,
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> & {
  /** Nombre accesible del campo. */
  etiqueta: string
  valor: string
  onCambiar: (texto: string) => void
  tamano?: 'normal' | 'grande'
  /** Tecla que lleva al buscador, para mostrarla a la derecha. */
  atajo?: ReactNode
}) {
  return (
    <label className={`f-buscar ${className}`.trim()} data-tamano={tamano}>
      <IconoBuscar />
      <input
        type="search"
        autoComplete="off"
        {...props}
        aria-label={etiqueta}
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
      />
      {atajo && <span className="f-tecla" aria-hidden="true">{atajo}</span>}
    </label>
  )
}
