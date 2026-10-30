'use client'

import { useState } from 'react'
import type { ItemVenta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { IconoEliminar, IconoEscanear, IconoMasCantidad, IconoMenos } from '@/ui/sistema/iconos'
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
    <div className="f-venta-arranquer" role="group" aria-label="¿Borrar todo?">
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

/** El número de unidades de un renglón: se toca y se escribe la cantidad
 *  exacta (12 en vez de apretar "+" doce veces). Enter confirma, Esc
 *  cancela, 0 saca el producto y nunca se pasa del stock. */
function CantidadEditable({
  nombre, cantidad, maximo, onCambiar, onSinStock,
}: { nombre: string; cantidad: number; maximo: number; onCambiar: (cantidad: number) => void; onSinStock: () => void }) {
  const [texto, setTexto] = useState<string | null>(null)

  function confirmar() {
    if (texto === null) return
    const pedida = Number(texto)
    setTexto(null)
    if (texto === '' || !Number.isFinite(pedida) || pedida === cantidad) return
    if (pedida > maximo) {
      onCambiar(maximo)
      onSinStock()
      return
    }
    onCambiar(pedida)
  }

  if (texto !== null) {
    return (
      <input
        className="f-paso-n f-paso-campo f-plata"
        aria-label={`Cantidad de ${nombre}`}
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={texto}
        onFocus={(evento) => evento.target.select()}
        onChange={(evento) => setTexto(evento.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={confirmar}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') { evento.preventDefault(); confirmar() }
          if (evento.key === 'Escape') { evento.stopPropagation(); setTexto(null) }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className="f-paso-n f-paso-editar f-plata"
      aria-label={`${cantidad} unidades de ${nombre}. Tocá para escribir la cantidad`}
      title="Escribir la cantidad"
      onClick={() => setTexto(String(cantidad))}
    >
      {cantidad}
    </button>
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
  destacado,
  idVarios,
}: {
  items: ItemVenta[]
  /** El renglón de monto libre: se muestra como importe, sin cantidad. */
  idVarios?: string | null
  /** El renglón que acaba de cambiar: se ilumina un instante. */
  destacado?: { id: string; vez: number } | null
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
      <div className="f-venta-arranque">
        <EstadoVacio compacto icono={<IconoEscanear />} titulo="Todavía no hay nada en la venta" texto="Escaneá o tocá un producto para empezar." />
        <ul className="f-venta-atajos f-solo-pc" aria-label="Atajos de teclado">
          <li><kbd>/</kbd> buscar</li>
          <li><kbd>Esc</kbd> limpiar</li>
          <li><kbd>F2</kbd> monto libre</li>
          <li><kbd>+</kbd> <kbd>−</kbd> cantidad</li>
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer</li>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> cobrar</li>
        </ul>
      </div>
    )
  }

  return (
    <ul className="f-venta-renglones">
      {items.map((item) => {
        const sinMas = item.cantidad >= (stockPorProducto[item.productoId] ?? 0)
        const final = cobrables?.find((candidato) => candidato.productoId === item.productoId) ?? item
        const rebajado = final.precio !== item.precio
        const destello = destacado?.id === item.productoId
        if (item.productoId === idVarios) {
          return (
            <li
              key={destello ? `${item.productoId}-${destacado.vez}` : item.productoId}
              className="f-renglon f-venta-renglon"
              data-destello={destello ? 'true' : undefined}
            >
              <span className="f-renglon-cuerpo">
                <strong className="f-renglon-titulo">{item.nombre}</strong>
                <span className="f-renglon-detalle">Monto libre</span>
              </span>
              <button type="button" className="f-venta-quitar" onClick={() => onCambiarCantidad(item.productoId, 0)} aria-label={`Quitar ${item.nombre}`} title="Quitar">
                <IconoEliminar />
              </button>
              <span className="f-renglon-fin f-venta-subtotal">{formatearPesos(final.precio * item.cantidad)}</span>
            </li>
          )
        }
        return (
          <li
            key={destello ? `${item.productoId}-${destacado.vez}` : item.productoId}
            className="f-renglon f-venta-renglon"
            data-destello={destello ? 'true' : undefined}
          >
            <span className="f-renglon-cuerpo">
              <strong className="f-renglon-titulo">{item.nombre}</strong>
              {/* El precio por unidad sólo suma si hay más de una o si tiene descuento. */}
              {(item.cantidad > 1 || rebajado) && (
                <span className="f-renglon-detalle f-plata">
                  {rebajado && <s>{formatearPesos(item.precio)}</s>} {formatearPesos(final.precio)} c/u
                </span>
              )}
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
              <CantidadEditable
                nombre={item.nombre}
                cantidad={item.cantidad}
                maximo={stockPorProducto[item.productoId] ?? 0}
                onCambiar={(cantidad) => onCambiarCantidad(item.productoId, cantidad)}
                onSinStock={() => onSinStock?.(item.productoId)}
              />
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
