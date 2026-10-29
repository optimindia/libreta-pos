import Link from 'next/link'
import type { ReactNode } from 'react'
import { Boton, clasesBoton, type VarianteBoton } from './Boton'

export interface AccionEstado {
  etiqueta: string
  /** Para un botón. */
  alTocar?: () => void
  /** Para un enlace a otra pantalla. */
  href?: string
  /** `secundario` salvo que sea lo único lima de la pantalla. */
  variante?: VarianteBoton
}

/** Lista o bloque sin nada todavía: dice qué pasa y qué hacer ahora.
 *  `compacto` es para un bloque dentro de una tarjeta que ya tiene su título
 *  (no agrega encabezado ni fondo). `nivel` es el encabezado de la versión
 *  grande. */
export function EstadoVacio({
  titulo,
  texto,
  icono,
  accion,
  compacto = false,
  nivel = 2,
  className = '',
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  titulo: string
  texto: string
  icono?: ReactNode
  accion?: AccionEstado
  compacto?: boolean
  nivel?: 2 | 3
}) {
  const Titulo = compacto ? 'p' : nivel === 3 ? 'h3' : 'h2'
  const variante = accion?.variante ?? 'secundario'
  return (
    <section {...props} className={`f-estado f-estado-vacio ${className}`.trim()} data-compacto={compacto ? 'true' : undefined}>
      {icono && <span className="f-estado-icono" aria-hidden="true">{icono}</span>}
      <Titulo className="f-estado-titulo">{titulo}</Titulo>
      <p className="f-estado-texto">{texto}</p>
      {accion?.href && (
        <Link href={accion.href} className={clasesBoton(variante)}>{accion.etiqueta}</Link>
      )}
      {accion && !accion.href && (
        <Boton variante={variante} onClick={accion.alTocar}>{accion.etiqueta}</Boton>
      )}
    </section>
  )
}
