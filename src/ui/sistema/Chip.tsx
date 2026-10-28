'use client'

import type { ReactNode } from 'react'

/** Filtro con forma de chip (redondo). Prendido = tinta llena. Se anuncia
 *  como botón con `aria-pressed`. Para elegir una sola opción entre pocas
 *  fijas, usá Segmentado. */
export function Chip({
  activo,
  onClick,
  children,
  className = '',
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  activo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" {...props} className={`f-chip ${className}`.trim()} aria-pressed={activo} onClick={onClick}>
      {children}
    </button>
  )
}

/** Fila de chips que se desliza de costado en el celu (en la PC baja de
 *  renglón). */
export function Chips({ etiqueta, children, className = '' }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={`f-chips overflow-x-auto ${className}`.trim()} role="group" aria-label={etiqueta}>
      {children}
    </div>
  )
}
