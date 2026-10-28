import type { ReactNode } from 'react'

/** Un renglón de lista: título (16/700), detalle (13/600) y, a la derecha,
 *  lo que haga falta (un importe, botones). */
export function Renglon({
  titulo,
  detalle,
  inicio,
  fin,
  como: Como = 'div',
  className = '',
}: {
  titulo: ReactNode
  detalle?: ReactNode
  /** Algo a la izquierda: un avatar, un ícono. */
  inicio?: ReactNode
  fin?: ReactNode
  como?: 'div' | 'li'
  className?: string
}) {
  return (
    <Como className={`f-renglon ${className}`.trim()}>
      {inicio}
      <span className="f-renglon-cuerpo">
        <span className="f-renglon-titulo">{titulo}</span>
        {detalle && <span className="f-renglon-detalle">{detalle}</span>}
      </span>
      {fin}
    </Como>
  )
}
