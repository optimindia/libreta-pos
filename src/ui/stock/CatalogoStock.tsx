'use client'

import type { Producto } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'

/** Qué tan lleno está el nivel de stock respecto del mínimo: 0 es "se acabó",
 *  1 es "al mínimo justo", más de 1 sube hasta el tope visual de la barra. */
function nivel(producto: Producto): number {
  if (producto.stockMinimo <= 0) return 1
  return Math.max(0, Math.min(producto.stock / (producto.stockMinimo * 2), 1))
}

function colorNivel(producto: Producto): string {
  if (producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo) return 'var(--ambar)'
  return 'var(--verde)'
}

/** El catálogo como tarjetas con una barra de nivel: de un vistazo se ve
 *  qué está por agotarse, sin tener que leer cada número uno por uno. */
export function CatalogoStock({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) {
    return (
      <p className="mt-3 text-[13px]" style={{ color: 'var(--tenue)' }}>
        Todavía no cargaste ningún producto.
      </p>
    )
  }

  return (
    <ul className="mt-3 grid grid-cols-2 gap-2">
      {productos.map((producto) => (
        <li
          key={producto.id}
          className="rounded-2xl px-3.5 py-3"
          style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', boxShadow: 'var(--sombra)' }}
        >
          <div className="truncate text-[13px] font-medium">{producto.nombre}</div>
          <Importe centavos={producto.precio} tamaño="chico" className="mt-0.5" />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--linea)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${nivel(producto) * 100}%`, background: colorNivel(producto) }}
            />
          </div>
          <div className="tabular mt-1 text-[11px]" style={{ color: 'var(--tenue)' }}>
            quedan {producto.stock}
          </div>
        </li>
      ))}
    </ul>
  )
}