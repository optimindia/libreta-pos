'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { MAX_INTENTOS, reintentarTodos } from '@/datos/local/cola'
import { IconoAlerta, IconoCerrar } from './iconos'

/** Si algo no pudo subir a la nube (se agotaron los intentos o la nube lo
 *  rechazó), se avisa en cualquier pantalla con un botón para reintentar.
 *  Antes sólo se veía un "Sin subir" chiquito en el menú, y una venta podía
 *  quedar días sin llegar a los otros aparatos sin que nadie se enterara. */
export function AvisoSinSubir() {
  const trabados = useLiveQuery(
    async () => (await db.cola.toArray()).filter((item) => item.rechazado || item.intentos >= MAX_INTENTOS),
    [],
    [],
  )
  const [oculto, setOculto] = useState(false)
  const [reintentando, setReintentando] = useState(false)
  if (oculto || trabados.length === 0) return null

  const cantidad = trabados.length
  const rechazados = trabados.some((item) => item.rechazado)

  async function reintentar() {
    setReintentando(true)
    try {
      await reintentarTodos()
    } finally {
      setReintentando(false)
    }
  }

  return (
    <aside className="f-sin-subir" role="alert" aria-labelledby="f-sin-subir-titulo">
      <span className="f-sin-subir-icono" aria-hidden="true"><IconoAlerta /></span>
      <div className="f-sin-subir-texto">
        <strong id="f-sin-subir-titulo">
          {cantidad} {cantidad === 1 ? 'cambio no llegó' : 'cambios no llegaron'} a la nube
        </strong>
        <span>
          {rechazados
            ? 'La nube rechazó algo. Probá de nuevo; si se repite, avisanos.'
            : `${cantidad === 1 ? 'Está guardado' : 'Están guardados'} en este aparato. Probá de nuevo con señal.`}
        </span>
      </div>
      <button type="button" className="f-sin-subir-reintentar" disabled={reintentando} onClick={() => void reintentar()}>
        {reintentando ? 'Enviando…' : 'Reintentar'}
      </button>
      <button type="button" className="f-sin-subir-cerrar" aria-label="Ocultar este aviso" onClick={() => setOculto(true)}>
        <IconoCerrar />
      </button>
    </aside>
  )
}
