'use client'

import { useState } from 'react'
import type { ItemVenta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { IconoMasCantidad, IconoMenos } from '@/ui/sistema/iconos'

/** "Vaciar" la venta, con una confirmación en el lugar: un toque de más no
 *  borra todo. */
export function VaciarVenta({ onVaciar }: { onVaciar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button type="button" className="f-boton f-boton-secundario" data-tamano="chico" onClick={() => setConfirmando(true)}>
        Vaciar venta
      </button>
    )
  }
  return (
    <div className="f-venta-vaciar" role="group" aria-label="¿Borrar todo?">
      <span>¿Borrar todo?</span>
      <button type="button" className="f-boton f-boton-cuidado" data-tamano="chico" onClick={() => { onVaciar(); setConfirmando(false) }}>
        Sí, vaciar
      </button>
      <button type="button" className="f-boton f-boton-secundario" data-tamano="chico" onClick={() => setConfirmando(false)}>
        No
      </button>
    </div>
  )
}

/** Los renglones de la venta en curso: nombre y precio por unidad, − y +
 *  para la cantidad y el subtotal a la derecha. */
export function Ticket({
  items,
  onCambiarCantidad,
  stockPorProducto,
  onSinStock,
}: {
  items: ItemVenta[]
  onCambiarCantidad: (productoId: string, cantidad: number) => void
  stockPorProducto: Record<string, number>
  onSinStock?: (productoId: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="f-venta-vacia">
        <strong>Listo para anotar</strong>
        <p>Escaneá o tocá un producto para empezar la venta.</p>
      </div>
    )
  }

  return (
    <ul className="f-venta-renglones">
      {items.map((item) => {
        const sinMas = item.cantidad >= (stockPorProducto[item.productoId] ?? 0)
        return (
          <li key={item.productoId} className="f-renglon f-venta-renglon">
            <span className="f-renglon-cuerpo">
              <strong className="f-renglon-titulo">{item.nombre}</strong>
              <span className="f-renglon-detalle f-plata">{formatearPesos(item.precio)} c/u</span>
            </span>
            <span className="f-paso">
              <button
                type="button"
                title="Quitar una unidad"
                onClick={() => onCambiarCantidad(item.productoId, item.cantidad - 1)}
                aria-label={`Quitar uno de ${item.nombre}`}
              >
                <IconoMenos />
              </button>
              <span className="f-paso-n f-plata" aria-label={`${item.cantidad} unidades`}>{item.cantidad}</span>
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
            </span>
            <span className="f-renglon-fin f-venta-subtotal">{formatearPesos(item.precio * item.cantidad)}</span>
          </li>
        )
      })}
    </ul>
  )
}
