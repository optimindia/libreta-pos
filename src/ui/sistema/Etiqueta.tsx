import type { ReactNode } from 'react'

export type TonoEtiqueta = 'verde' | 'coral' | 'ambar' | 'gris' | 'blanco'

/** Estado corto en forma de chip: "Sin stock", "Vencido", "Al día". El
 *  color dice qué significa (verde entra plata, coral te deben, ámbar
 *  atención, gris no disponible). */
export function Etiqueta({
  tono = 'gris',
  punto = false,
  children,
  className = '',
}: {
  tono?: TonoEtiqueta
  punto?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`f-etiqueta ${className}`.trim()} data-tono={tono}>
      {punto && <span className="f-etiqueta-punto" aria-hidden="true" />}
      {children}
    </span>
  )
}
