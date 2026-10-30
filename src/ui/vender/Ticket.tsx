'use client'

import { useState } from 'react'
import type { ItemVenta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { IconoMasCantidad, IconoMenos } from '@/ui/sistema/iconos'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'

/** "Vaciar" la venta, con una confirmación en el lugar: un toque de más no
 *  borra todo. */
export function VaciarVenta({ onVaciar, etiqueta = 'Vaciar venta', confirmar = 'Sí, vaciar' }: { onVaciar: () => void; etiqueta?: string; confirmar?: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button type="button" className="f-boton f-boton-secundario" data-tamano="chico" onClick={() => setConfirmando(true)}>
        {etiqueta}
      </button>
    )
  }
  return (
    <div className="f-venta-vaciar" role="group" aria-label="¿Borrar todo?">
      <span>¿Borrar todo?</span>
      <button type="button" className="f-boton f-boton-cuidado" data-tamano="chico" onClick={() => { onVaciar(); setConfirmando(false) }}>
        {confirmar}
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
  cobrables,
  onDescuento,
}: {
  items: ItemVenta[]
  /** Los mismos renglones con los descuentos aplicados, tal como se cobran. */
  cobrables?: ItemVenta[]
  /** Abre el descuento de un renglón. */
  onDescuento?: (productoId: string) => void
  onCambiarCantidad: (productoId: string, cantidad: number) => void
  stockPorProducto: Record<string, number>
  onSinStock?: (productoId: string) => void
}) {
  if (items.length === 0) {
    return (
      <EstadoVacio compacto titulo="Todavía no hay nada en la venta" texto="Escaneá o tocá un producto para empezar." />
    )
  }

  return (
    <ul className="f-venta-renglones">
      {items.map((item) => {
        const sinMas = item.cantidad >= (stockPorProducto[item.productoId] ?? 0)
        const final = cobrables?.find((candidato) => candidato.productoId === item.productoId) ?? item
        const rebajado = final.precio !== item.precio
        return (
          <li key={item.productoId} className="f-renglon f-venta-renglon">
            <span className="f-renglon-cuerpo">
              <strong className="f-renglon-titulo">{item.nombre}</strong>
              <span className="f-renglon-detalle f-plata">
                {rebajado && <s>{formatearPesos(item.precio)}</s>} {formatearPesos(final.precio)} c/u
              </span>
              {item.cantidad > (stockPorProducto[item.productoId] ?? 0) && (
                <span className="f-venta-falta" role="status">Solo quedan {stockPorProducto[item.productoId] ?? 0}</span>
              )}
              {onDescuento && (
                <button type="button" className="f-venta-descuento" onClick={() => onDescuento(item.productoId)} aria-label={`${rebajado ? 'Cambiar el descuento de' : 'Descuento para'} ${item.nombre}`}>
                  {rebajado ? 'Cambiar descuento' : 'Descuento'}
                </button>
              )}
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
            <span className="f-renglon-fin f-venta-subtotal">{formatearPesos(final.precio * item.cantidad)}</span>
          </li>
        )
      })}
    </ul>
  )
}
