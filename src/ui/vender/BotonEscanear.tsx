'use client'

import { useRef, useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { repos } from '@/datos/local/repos'
import { escanear } from './escaner'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoEscanear } from '@/ui/sistema/iconos'

export function BotonEscanear({ onProducto, onNoEncontrado }: { onProducto: (producto: Producto) => void; onNoEncontrado?: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const detener = useRef<(() => void) | null>(null)
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
    // el video recién existe después de pintar el panel
    await new Promise((seguir) => requestAnimationFrame(seguir))
    if (!video.current) return
    try {
      detener.current = await escanear(video.current, async (codigo) => {
        const producto = await repos.productos.porCodigoBarras(codigo)
        if (producto) {
          onProducto(producto)
          cerrar()
        } else {
          setAviso('Ese código todavía no está cargado. Podés cargarlo desde Stock.')
          onNoEncontrado?.(codigo)
        }
      })
    } catch {
      setAviso('No se pudo abrir la cámara. Podés buscar el producto por nombre.')
    }
  }

  return (
    <>
      <button type="button" className="sale-scan-card" onClick={() => void abrir()}>
        <span className="sale-scan-card-icon"><IconoEscanear /></span>
        <span className="sale-scan-card-copy"><strong>Escanear para vender</strong><small>Usá el lector o abrí la cámara para sumar al ticket.</small></span>
        <span className="sale-scan-card-reader"><i aria-hidden="true" />Lector USB/Bluetooth · código + Enter</span>
        <span className="sale-scan-card-action">Abrir cámara</span>
      </button>
      {abierto && (
        <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Escanear producto para vender">
          <div className="scanner-topbar">
            <div><span>Venta rápida</span><strong>Escaneá el producto</strong></div>
            <button type="button" className="scanner-close" aria-label="Cerrar escáner" onClick={cerrar}><IconoCerrar /></button>
          </div>
          <video ref={video} className="scanner-video" playsInline muted />
          <div className="scanner-reticle" aria-hidden="true"><span /></div>
          <div className="scanner-sheet">
            <span className="scanner-sheet-icon"><IconoEscanear /></span>
            <div><strong>Apuntá al código de barras</strong><p>Cuando lo detectemos, el producto se suma al ticket automáticamente.</p></div>
            {aviso && <p className="scanner-warning" role="status">{aviso}</p>}
            <Boton variante="secundario" className="button-with-icon scanner-close-button" onClick={cerrar}><IconoCerrar /> Volver a la venta</Boton>
          </div>
        </div>
      )}
    </>
  )
}
