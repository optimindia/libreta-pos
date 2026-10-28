'use client'

import { useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { precioVigente } from '@/dominio/ticket'
import { repos } from '@/datos/local/repos'
import { VisorCamara } from '@/ui/escaner/VisorCamara'
import { IconoEscanear } from '@/ui/sistema/iconos'

/** El botón de la cámara de Vender. La cámara queda abierta y va sumando
 *  producto tras producto; cada lectura suena y dice qué pasó.
 *  `onProducto` devuelve `null` si el producto entró al ticket, o el motivo
 *  por el que no (sin stock, sin precio). */
export function BotonEscanear({
  onProducto,
  onNoEncontrado,
}: {
  onProducto: (producto: Producto) => string | null | void
  onNoEncontrado?: (codigo: string) => void
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button type="button" className="f-boton f-boton-secundario f-escanear" aria-label="Escanear con la cámara" title="Escanear código con la cámara" onClick={() => setAbierto(true)}>
        <IconoEscanear /><span className="f-escanear-texto" aria-hidden="true">Cámara</span>
      </button>
      {abierto && (
        <VisorCamara
          continuo
          titulo="Escaneá los productos"
          ayuda="Apuntá al código de barras. Cada producto se suma solo al ticket."
          textoListo="Ver la venta"
          onCerrar={() => setAbierto(false)}
          alLeer={async (codigo) => {
            const producto = await repos.productos.porCodigoBarras(codigo)
            if (!producto) {
              onNoEncontrado?.(codigo)
              return { tipo: 'falta', texto: `El código ${codigo} todavía no está cargado. Cargalo desde Stock.` }
            }
            const problema = onProducto(producto)
            if (problema) return { tipo: 'falta', texto: problema }
            return { tipo: 'ok', texto: `✓ ${producto.nombre} · ${formatearPesos(precioVigente(producto))}` }
          }}
        />
      )}
    </>
  )
}
