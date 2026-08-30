'use client'

import type { ItemVenta } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join('')
}

export function Ticket({
  items,
  onCambiarCantidad,
}: {
  items: ItemVenta[]
  onCambiarCantidad: (productoId: string, cantidad: number) => void
}) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--tenue)' }}>
        Escaneá o tocá un producto para empezar la venta.
      </p>
    )
  }

  return (
    <ul className="px-5">
      {items.map((item) => (
        <li
          key={item.productoId}
          className="flex items-center gap-3 py-2.5"
          style={{ borderBottom: '1px solid var(--linea)' }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold"
            style={{ background: 'var(--chip-fondo)', color: 'var(--tenue)' }}
          >
            {iniciales(item.nombre)}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-medium">{item.nombre}</div>
            <button
              className="text-[11px]"
              style={{ color: 'var(--tenue)' }}
              onClick={() => onCambiarCantidad(item.productoId, item.cantidad - 1)}
              aria-label={`Quitar uno de ${item.nombre}`}
            >
              {item.cantidad} × {(item.precio / 100).toLocaleString('es-AR')}
            </button>
          </div>
          <Importe centavos={item.precio * item.cantidad} tamaño="chico" />
        </li>
      ))}
    </ul>
  )
}
