import { Boton } from './Boton'
import { IconoReintentar } from './iconos'
import { TEXTOS } from './textos'

/** Algo no cargó: lo cuenta sin culpar a nadie y ofrece Reintentar cuando
 *  hay una forma de volver a pedirlo. */
export function EstadoError({
  titulo,
  texto,
  onReintentar,
  compacto = false,
  className = '',
}: {
  titulo: string
  texto: string
  onReintentar?: () => void
  compacto?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={`f-estado f-estado-error ${className}`.trim()} data-compacto={compacto ? 'true' : undefined}>
      <p className="f-estado-titulo">{titulo}</p>
      <p className="f-estado-texto">{texto}</p>
      {onReintentar && (
        <Boton variante="secundario" onClick={onReintentar}>
          <IconoReintentar /> {TEXTOS.reintentar}
        </Boton>
      )}
    </div>
  )
}
