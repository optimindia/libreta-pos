'use client'

import { useState } from 'react'
import { VisorCamara } from '@/ui/escaner/VisorCamara'
import { IconoEscanear } from '@/ui/sistema/iconos'

/** Escáner de la carga: un botón y, al tocarlo, la cámara con un marco para
 *  apuntar al código. Con la primera lectura se cierra y completa la ficha. */
export function EscanearCodigoProducto({ onDetectar }: { onDetectar: (codigo: string) => void }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button type="button" className="f-stock-escanear" onClick={() => setAbierto(true)}>
        <span className="f-stock-escanear-icono" aria-hidden="true"><IconoEscanear /></span>
        <span className="f-stock-escanear-texto"><strong>Escanear para cargar</strong><small>Leé el código y completá el producto en segundos.</small></span>
        <span className="f-etiqueta" data-tono="gris">Abrir cámara</span>
      </button>

      {abierto && (
        <VisorCamara
          titulo="Escaneá el código del producto"
          ayuda="Apuntá al código de barras con buena luz; se carga solo al leerlo. Con un lector físico, pasalo en el campo de código."
          onCerrar={() => setAbierto(false)}
          alLeer={(codigo) => {
            onDetectar(codigo)
            return { tipo: 'ok', texto: `✓ Código ${codigo}` }
          }}
        />
      )}
    </>
  )
}
