'use client'

import { useRef, useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { repos } from '@/datos/local/repos'
import { escanear } from './escaner'
import { Boton } from '@/ui/sistema/Boton'

export function BotonEscanear({ onProducto }: { onProducto: (producto: Producto) => void }) {
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
          setAviso('Ese código todavía no está cargado. Agregalo desde Stock.')
        }
      })
    } catch {
      setAviso('No se pudo abrir la cámara. Podés buscar el producto por nombre.')
    }
  }

  return (
    <>
      <Boton variante="secundario" className="w-full !py-3 !text-[13px]" onClick={abrir}>
        Escanear
      </Boton>
      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--hueso)' }}>
          <video ref={video} className="flex-1 object-cover" playsInline muted />
          {aviso && <p className="px-5 py-3 text-sm" style={{ color: 'var(--ambar)' }}>{aviso}</p>}
          <div className="p-5">
            <Boton variante="secundario" className="w-full" onClick={cerrar}>Cerrar</Boton>
          </div>
        </div>
      )}
    </>
  )
}
