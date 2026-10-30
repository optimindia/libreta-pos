'use client'

import { formatearPesos } from '@/dominio/dinero'
import { totalTicket } from '@/dominio/ticket'
import { itemsParaCobrar, nombreDeVenta, ventaConContenido, type VentaAbierta } from '@/dominio/ventaAbierta'
import type { UUID } from '@/dominio/tipos'
import { Chip, Chips } from '@/ui/sistema/Chip'

/** Las ventas que están abiertas a la vez: una por cliente que espera. La
 *  activa va marcada; "Nueva venta" deja la actual guardada y abre otra. */
export function TiraVentas({
  ventas,
  activaId,
  llena,
  onElegir,
  onNueva,
}: {
  ventas: VentaAbierta[]
  activaId: UUID
  llena: boolean
  onElegir: (id: UUID) => void
  onNueva: () => void
}) {
  return (
    <Chips etiqueta="Ventas abiertas" className="f-ventas-tira">
      {ventas.map((venta, posicion) => {
        const nombre = nombreDeVenta(venta, posicion)
        const total = totalTicket(itemsParaCobrar(venta))
        return (
          <Chip key={venta.id} activo={venta.id === activaId} onClick={() => onElegir(venta.id)} aria-label={`${nombre}${ventaConContenido(venta) ? `, ${formatearPesos(total)}` : ', vacía'}`}>
            <span className="f-venta-pestana">{nombre}</span>
            {venta.items.length > 0 && <span className="f-plata">{formatearPesos(total)}</span>}
          </Chip>
        )
      })}
      <Chip
        activo={false}
        onClick={onNueva}
        disabled={llena}
        title={llena ? 'Ya tenés muchas ventas abiertas: cobrá o descartá alguna' : 'Guardar esta venta y empezar otra'}
        aria-label="Nueva venta"
      >
        + Nueva
      </Chip>
    </Chips>
  )
}
