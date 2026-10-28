// Botón del sistema F (estilos en f/componentes.css):
// · principal: lima con texto tinta. UNO por pantalla (Vender, Cobrar).
// · secundario: blanco con borde de 1,5 px.
// · cuidado: coral suave, para lo que deja deuda o borra (Anotar fiado).
// `tamano="caja"` lo lleva a 72 px, el alto del botón de cobrar.
const VARIANTES = {
  principal: 'f-boton-principal',
  secundario: 'f-boton-secundario',
  cuidado: 'f-boton-cuidado',
  /** Nombre viejo de `cuidado`; queda para no romper pantallas sin migrar. */
  fiado: 'f-boton-cuidado',
} as const

export type VarianteBoton = keyof typeof VARIANTES
export type TamanoBoton = 'chico' | 'normal' | 'grande' | 'caja'

/** Las clases de un botón F, para dárselas a un <Link> o un <a>. */
export function clasesBoton(variante: VarianteBoton = 'principal', className = ''): string {
  return `f-boton ${VARIANTES[variante]} ${className}`.trim()
}

export function Boton({
  variante = 'principal',
  tamano = 'normal',
  ancho = false,
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  /** Ocupa todo el ancho disponible. */
  ancho?: boolean
}) {
  return (
    <button
      type={type}
      {...props}
      data-variante={variante}
      data-tamano={tamano}
      data-ancho={ancho ? 'true' : undefined}
      // `libreta-button` queda como gancho de maquetación para las pantallas
      // que todavía no pasaron al sistema F (no aporta color ni forma).
      className={`libreta-button ${clasesBoton(variante, className)}`}
    />
  )
}
