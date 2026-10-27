'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Negocio, Venta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { gananciaVenta } from '@/dominio/ganancia'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { IconoSincronizado } from '@/ui/sistema/iconos'

const TEXTO_DEL_MEDIO: Record<Venta['medioPago'], string> = {
  efectivo: 'en efectivo',
  transferencia: 'por transferencia',
  qr: 'con QR',
  fiado: 'anotado en fiado',
}

/** El cierre de la venta: lo cobrado, bien grande, y el ticket a mano para
 *  mandarlo por WhatsApp. Si la venta lleva un cliente con teléfono, el
 *  enlace abre directo su chat; si no, el almacenero elige el chat. */
export function Cobrado({
  venta,
  negocio,
  onNueva,
}: {
  venta: Venta
  negocio: Negocio
  onNueva: () => void
}) {
  const cliente = useLiveQuery(
    async () => (venta.clienteId ? await db.clientes.get(venta.clienteId) : null),
    [],
  )
  const link = enlaceWhatsApp(cliente?.telefono ?? '', mensajeTicket(negocio, venta))

  return (
    <div className="mz-hoja" role="dialog" aria-modal="true" aria-label="Venta cobrada">
      <div className="mz-hoja-centro">
        <span className="mz-exito" aria-hidden="true"><IconoSincronizado /></span>
        <h2 className="mz-hoja-titulo">Cobrado {TEXTO_DEL_MEDIO[venta.medioPago]}</h2>
        <strong className="mz-hoja-monto tabular">{formatearPesos(venta.total)}</strong>
        <p className="mz-hoja-detalle">Ganaste <b className="tabular">{formatearPesos(gananciaVenta(venta))}</b> con esta venta</p>
      </div>
      <div className="mz-hoja-pie">
        <button type="button" className="mz-cobrar mz-toque" onClick={onNueva}>Nueva venta</button>
        <a href={link} target="_blank" rel="noopener noreferrer" className="mz-secundario mz-toque">
          Mandar el ticket por WhatsApp
        </a>
      </div>
    </div>
  )
}
