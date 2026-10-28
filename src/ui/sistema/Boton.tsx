// El aspecto de cada variante vive en nativo.css (.nb-boton-*): superficie
// sólida, borde que se ve aun en un monitor viejo y un hundido al apretar.
const VARIANTES = {
  principal: 'nb-boton-principal',
  secundario: 'nb-boton-secundario',
  fiado: 'nb-boton-fiado',
} as const

export function Boton({
  variante = 'principal',
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES
}) {
  return (
    <button
      type={type}
      {...props}
      data-variante={variante}
      className={`libreta-button nb-boton ${VARIANTES[variante]} touch-manipulation rounded-2xl px-5 py-3.5 text-base font-bold disabled:pointer-events-none disabled:opacity-40 ${className}`}
    />
  )
}
