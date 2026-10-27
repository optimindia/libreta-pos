'use client'

import { useRef, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoEscanear } from '@/ui/sistema/iconos'
import { escanear } from '@/ui/vender/escaner'

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
      <button type="button" className="stock-scan-card" onClick={() => void abrir()}>
        <span className="stock-scan-card-icon"><IconoEscanear /></span>
        <span className="stock-scan-card-copy"><strong>Escanear para cargar</strong><small>Leé el código y completá el producto en segundos.</small></span>
        <span className="stock-scan-card-action">Abrir cámara</span>
      </button>

      {abierto && (
        <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
          <div className="scanner-topbar">
            <div><span>Alta rápida</span><strong>Escaneá el código</strong></div>
            <button type="button" className="scanner-close" aria-label="Cerrar escáner" onClick={cerrar}><IconoCerrar /></button>
          </div>
          <video ref={video} className="scanner-video" playsInline muted />
          <div className="scanner-reticle" aria-hidden="true"><span /></div>
          <div className="scanner-sheet">
            <span className="scanner-sheet-icon"><IconoEscanear /></span>
            <div><strong>Apuntá al código de barras</strong><p>Mantenelo dentro del marco con buena luz. Se carga automáticamente al leerlo.</p></div>
            {aviso && <p className="scanner-warning" role="status">{aviso}</p>}
            <Boton variante="secundario" className="button-with-icon scanner-close-button" onClick={cerrar}><IconoCerrar /> Volver a la carga manual</Boton>
          </div>
        </div>
      )}
    </>
  )
}
