'use client'

import { useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { precioVigente } from '@/dominio/ticket'
import { repos } from '@/datos/local/repos'
import { VisorCamara, type DatosProductoNuevo } from '@/ui/escaner/VisorCamara'
import { IconoEscanear } from '@/ui/sistema/iconos'
import { usePuede } from '@/ui/sistema/usoRol'
import { pesosACentavos } from '@/dominio/dinero'

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
  // Cargar productos es del dueño: el vendedor sólo ve el aviso.
  const puedeCargar = usePuede('editarProductos')

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
          alCargar={puedeCargar ? async (datos: DatosProductoNuevo) => {
            const producto = await repos.productos.guardar({
              codigoBarras: datos.codigo,
              nombre: datos.nombre,
              costo: pesosACentavos(datos.costo),
              precio: pesosACentavos(datos.precio),
              stock: datos.stock,
              stockMinimo: 1,
            })
            const problema = onProducto(producto)
            if (problema) return { tipo: 'falta', texto: problema }
            return { tipo: 'ok', texto: `✓ Cargado y sumado: ${producto.nombre} · ${formatearPesos(precioVigente(producto))}` }
          } : undefined}
          alLeer={async (codigo) => {
            const producto = await repos.productos.porCodigoBarras(codigo)
            if (!producto) {
              onNoEncontrado?.(codigo)
              return puedeCargar
                ? { tipo: 'falta', texto: `El código ${codigo} todavía no está cargado.`, codigo }
                : { tipo: 'falta', texto: `El código ${codigo} no está cargado. Pedile al dueño que lo cargue.` }
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
