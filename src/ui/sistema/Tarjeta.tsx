import type { ElementType, ReactNode } from 'react'

/** Superficie blanca de radio 18, sin borde ni sombra: se separa del fondo
 *  por el color. */
export function Tarjeta({
  como: Como = 'div',
  relleno = 'normal',
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  como?: ElementType
  relleno?: 'ninguno' | 'normal' | 'grande'
  children: ReactNode
}) {
  return (
    <Como {...props} className={`f-tarjeta ${className}`.trim()} data-relleno={relleno}>
      {children}
    </Como>
  )
}
