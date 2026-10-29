'use client'

import { useEffect, useRef, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'
import './pin.css'

/** Muestra un dato secreto UNA sola vez: el PIN temporal de un vendedor o el
 *  código de recuperación del dueño. Vive sólo en el estado del componente:
 *  no se guarda en el aparato ni se escribe en consola, y al tocar "Ya lo
 *  guardé" desaparece para siempre. Se puede copiar y, si `imprimible`,
 *  imprimir (la hoja impresa muestra sólo esto). */
export function ValorUnaVez({
  titulo,
  valor,
  aviso,
  etiquetaCopiar,
  imprimible = false,
  textoListo = 'Ya lo guardé',
  onListo,
}: {
  titulo: string
  valor: string
  aviso: string
  etiquetaCopiar: string
  imprimible?: boolean
  textoListo?: string
  onListo: () => void
}) {
  const encabezado = useRef<HTMLHeadingElement>(null)
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null)

  useEffect(() => {
    encabezado.current?.focus()
  }, [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado('si')
    } catch {
      setCopiado('no')
    }
  }

  return (
    <section className="f-pin-unavez f-tarjeta" data-relleno="normal" aria-labelledby="f-pin-unavez-titulo">
      <h2 id="f-pin-unavez-titulo" ref={encabezado} tabIndex={-1} className="f-seccion">{titulo}</h2>
      <p className="f-texto">{aviso}</p>
      <div className="f-pin-hoja">
        <p className="f-pin-hoja-titulo">Libreta · {titulo}</p>
        <p className="f-pin-valor">{valor}</p>
      </div>
      <div className="f-pin-acciones">
        <Boton variante="secundario" onClick={() => void copiar()}>{etiquetaCopiar}</Boton>
        {imprimible && <Boton variante="secundario" onClick={() => window.print()}>Imprimir</Boton>}
        <Boton variante="principal" onClick={onListo}>{textoListo}</Boton>
      </div>
      <p className="f-dato" role="status">
        {copiado === 'si' && 'Copiado.'}
        {copiado === 'no' && 'No se pudo copiar. Anotalo a mano.'}
      </p>
    </section>
  )
}
