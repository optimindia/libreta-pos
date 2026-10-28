'use client'

import { useRef, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoEscanear } from '@/ui/sistema/iconos'
import { escanear } from '@/ui/vender/escaner'

/** Escáner de la carga: un botón y, al tocarlo, la cámara a pantalla
 *  completa con un marco para apuntar al código. */
export function EscanearCodigoProducto({ onDetectar }: { onDetectar: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const detener = useRef<(() => void) | null>(null)
  const procesado = useRef(false)
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  function cerrar() {
    detener.current?.()
    detener.current = null
    setAbierto(false)
  }

  async function abrir() {
    setAbierto(true)
    setAviso(null)
    procesado.current = false
    await new Promise((seguir) => requestAnimationFrame(seguir))
    if (!video.current) return
    try {
      detener.current = await escanear(video.current, (codigo) => {
        if (procesado.current) return
        procesado.current = true
        onDetectar(codigo)
        cerrar()
      })
    } catch {
      setAviso('No pudimos abrir la cámara. Revisá el permiso o escribí el código a mano.')
    }
  }

  return (
    <>
      <button type="button" className="f-stock-escanear" onClick={() => void abrir()}>
        <span className="f-stock-escanear-icono" aria-hidden="true"><IconoEscanear /></span>
        <span className="f-stock-escanear-texto"><strong>Escanear para cargar</strong><small>Leé el código y completá el producto en segundos.</small></span>
        <span className="f-etiqueta" data-tono="gris">Abrir cámara</span>
      </button>

      {abierto && (
        <div className="f-stock-camara" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
          <video ref={video} className="f-stock-camara-video" playsInline muted />
          <div className="f-stock-camara-marco" aria-hidden="true"><span /></div>
          <div className="f-stock-camara-cabeza">
            <span className="f-stock-camara-titulo">Escaneá el código</span>
            <button type="button" className="f-hoja-cerrar" aria-label="Cerrar escáner" onClick={cerrar}><IconoCerrar /></button>
          </div>
          <div className="f-stock-camara-pie">
            <p className="f-hoja-ayuda"><b>Apuntá al código de barras.</b> Mantenelo dentro del marco con buena luz; se carga solo al leerlo.</p>
            {aviso && <p className="f-aviso" data-tono="ambar" role="status">{aviso}</p>}
            <Boton variante="secundario" ancho onClick={cerrar}>Volver a la carga manual</Boton>
          </div>
        </div>
      )}
    </>
  )
}
