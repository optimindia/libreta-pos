import { TEXTOS } from './textos'

/** Esqueleto liviano mientras llegan los datos: barras grises, sin spinner.
 *  Con "reducir movimiento" las barras quedan quietas (ver f/estados.css). */
export function EstadoCarga({
  texto = TEXTOS.preparando,
  filas = 3,
  compacto = false,
  className = '',
}: {
  /** Lo que lee el lector de pantalla y se ve arriba del esqueleto. */
  texto?: string
  filas?: number
  compacto?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`f-estado f-estado-carga ${className}`.trim()}
      data-compacto={compacto ? 'true' : undefined}
    >
      <p className="f-estado-texto">{texto}</p>
      <div className="f-estado-barras" aria-hidden="true">
        {Array.from({ length: filas }, (_, i) => (
          <span key={i} className="f-estado-barra" />
        ))}
      </div>
    </div>
  )
}
