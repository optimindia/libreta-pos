'use client'

import { useState } from 'react'
import type { ItemVenta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { IconoMasCantidad, IconoMenos } from '@/ui/sistema/iconos'

/** El ticket en curso: cada renglón con su cantidad y botones grandes para
 *  sumar o quitar, y el subtotal a la derecha. */
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
      <div className="mz-ticket-vacio">
        <strong>Listo para anotar</strong>
        <p>Escaneá o tocá un producto para empezar la venta.</p>
      </div>
    )
  }

  return (
    <div className="mz-ticket">
      <div className="mz-ticket-acciones">
        {!confirmandoVaciar ? (
          <button type="button" className="mz-texto-boton" onClick={() => setConfirmandoVaciar(true)}>
            Vaciar venta
          </button>
        ) : (
          <div className="mz-confirmar-vaciar">
            <span>¿Borrar todo?</span>
            <button type="button" className="mz-texto-boton mz-texto-rojo" onClick={() => { onVaciar?.(); setConfirmandoVaciar(false) }}>
              Sí, vaciar
            </button>
            <button type="button" className="mz-texto-boton" onClick={() => setConfirmandoVaciar(false)}>
              No
            </button>
          </div>
        )}
      </div>
      <ul className="mz-renglones">
        {items.map((item) => {
          const sinMas = item.cantidad >= (stockPorProducto[item.productoId] ?? 0)
          return (
            <li key={item.productoId} className="mz-renglon">
              <div className="mz-renglon-datos">
                <strong>{item.nombre}</strong>
                <span className="tabular">{formatearPesos(item.precio)} c/u</span>
              </div>
              <div className="mz-paso">
                <button
                  type="button"
                  title="Quitar una unidad"
                  onClick={() => onCambiarCantidad(item.productoId, item.cantidad - 1)}
                  aria-label={`Quitar uno de ${item.nombre}`}
                >
                  <IconoMenos />
                </button>
                <span className="mz-paso-n tabular" aria-label={`${item.cantidad} unidades`}>{item.cantidad}</span>
                <button
                  type="button"
                  disabled={sinMas}
                  title={sinMas ? 'Stock máximo alcanzado' : 'Agregar una unidad'}
                  onClick={() => {
                    if (sinMas) onSinStock?.(item.productoId)
                    else onCambiarCantidad(item.productoId, item.cantidad + 1)
                  }}
                  aria-label={`Agregar uno de ${item.nombre}`}
                >
                  <IconoMasCantidad />
                </button>
              </div>
              <span className="mz-renglon-subtotal tabular">{formatearPesos(item.precio * item.cantidad)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
