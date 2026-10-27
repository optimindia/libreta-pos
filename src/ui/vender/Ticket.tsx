'use client'

import type { ItemVenta } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'
import { IconoHistorial, IconoMasCantidad, IconoMenos } from '@/ui/sistema/iconos'
import { useState } from 'react'

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join('')
}

export function Ticket({
  items,
  onCambiarCantidad,
  onVaciar,
  stockPorProducto,
  onSinStock,
}: {
  items: ItemVenta[]
  onCambiarCantidad: (productoId: string, cantidad: number) => void
  onVaciar?: () => void
  stockPorProducto: Record<string, number>
  onSinStock?: (productoId: string) => void
}) {
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false)

  if (items.length === 0) {
    return (
      <div className="ticket-empty px-5 py-8 text-center">
        <span className="ticket-empty-icon" aria-hidden="true">
          <IconoHistorial />
        </span>
        <strong className="mt-3 block text-[13px]">Listo para anotar</strong>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Escaneá o tocá un producto para empezar la venta.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5">
      <div className="mb-1 flex justify-end">
        {!confirmandoVaciar ? (
          <button
            type="button"
            className="text-[12px] font-medium"
            style={{ color: 'var(--tenue)' }}
            onClick={() => setConfirmandoVaciar(true)}
          >
            Vaciar venta
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ color: 'var(--tenue)' }}>¿Borrar todo?</span>
            <button
              type="button"
              className="font-semibold"
              style={{ color: 'var(--ambar)' }}
              onClick={() => { onVaciar?.(); setConfirmandoVaciar(false) }}
            >
              Sí, vaciar
            </button>
            <button type="button" style={{ color: 'var(--tenue)' }} onClick={() => setConfirmandoVaciar(false)}>
              No
            </button>
          </div>
        )}
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.productoId}
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: '1px solid var(--linea)' }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold"
              style={{ background: 'var(--chip-fondo)', color: 'var(--tenue)' }}
            >
              {iniciales(item.nombre)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium">{item.nombre}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  className="ticket-quantity-button flex h-6 w-6 items-center justify-center rounded-md text-[15px]"
                  style={{ background: 'var(--chip-fondo)', color: 'var(--tinta)' }}
                  title="Quitar una unidad"
                  onClick={() => onCambiarCantidad(item.productoId, item.cantidad - 1)}
                  aria-label={`Quitar uno de ${item.nombre}`}
                >
                  <IconoMenos />
                </button>
                <span className="tabular text-[12px]" style={{ color: 'var(--tenue)' }}>
                  {item.cantidad} × {(item.precio / 100).toLocaleString('es-AR')}
                </span>
                <button
                  type="button"
                  className="ticket-quantity-button flex h-6 w-6 items-center justify-center rounded-md text-[15px] disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ background: 'var(--chip-fondo)', color: 'var(--tinta)' }}
                  disabled={item.cantidad >= (stockPorProducto[item.productoId] ?? 0)}
                  title={item.cantidad >= (stockPorProducto[item.productoId] ?? 0) ? 'Stock máximo alcanzado' : 'Agregar una unidad'}
                  onClick={() => {
                    if (item.cantidad >= (stockPorProducto[item.productoId] ?? 0)) onSinStock?.(item.productoId)
                    else onCambiarCantidad(item.productoId, item.cantidad + 1)
                  }}
                  aria-label={`Agregar uno de ${item.nombre}`}
                >
                  <IconoMasCantidad />
                </button>
              </div>
            </div>
            <Importe centavos={item.precio * item.cantidad} tamaño="chico" />
          </li>
        ))}
      </ul>
    </div>
  )
}
