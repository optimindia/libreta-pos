'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { formatearPesos } from '@/dominio/dinero'
import { useContador } from './usoContador'

/** Portadas que ya se vieron en esta visita: la animación de entrada pasa
 *  una vez por sección; al volver, todo aparece en el acto. */
const vistas = new Set<string>()

/** La cabecera de cada sección: una franja oscura con el renglonado de una
 *  libreta, el título, el número que importa (que sube al entrar) y la
 *  acción principal a mano. El lector de pantalla lee el valor final. */
export function Portada({
  id,
  contexto,
  titulo,
  subtitulo,
  rotulo,
  valor,
  formato = 'pesos',
  sufijo,
  tono = 'lima',
  detalle,
  accion,
  animar,
  className = '',
}: {
  /** Identifica la sección para animar sólo la primera vez. */
  id: string
  /** Línea chica arriba del título (fecha, negocio). */
  contexto?: string
  titulo: string
  subtitulo?: string
  /** Qué es el número grande ("Te deben"). */
  rotulo?: string
  valor?: number
  formato?: 'pesos' | 'numero'
  sufijo?: string
  tono?: 'lima' | 'coral' | 'ambar'
  detalle?: ReactNode
  accion?: ReactNode
  /** Fuerza animar o no; por defecto, sólo la primera visita. */
  animar?: boolean
  className?: string
}) {
  const [primera] = useState(() => !vistas.has(id))
  useEffect(() => { vistas.add(id) }, [id])
  const entra = animar ?? primera
  const mostrado = useContador(valor ?? 0, { animar: entra, paso: formato === 'pesos' ? 100 : 1 })
  const escribir = (n: number) => (formato === 'pesos' ? formatearPesos(n) : n.toLocaleString('es-AR'))

  return (
    <header className={`f-portada ${className}`.trim()} data-entrada={entra ? 'true' : undefined}>
      <div className="f-portada-texto">
        {contexto && <p className="f-portada-contexto">{contexto}</p>}
        <h1 id={`portada-${id}`} className="f-portada-titulo">{titulo}</h1>
        {subtitulo && <p className="f-portada-subtitulo">{subtitulo}</p>}
        {valor !== undefined && (
          <>
            {rotulo && <p className="f-portada-rotulo">{rotulo}</p>}
            <p className="f-portada-valor" data-tono={tono}>
              <span aria-hidden="true">{escribir(mostrado)}{sufijo && <small>{sufijo}</small>}</span>
              <span className="f-sr">{escribir(valor)}{sufijo ?? ''}</span>
            </p>
          </>
        )}
        {detalle && <div className="f-portada-detalle">{detalle}</div>}
      </div>
      {accion && <div className="f-portada-accion">{accion}</div>}
    </header>
  )
}
