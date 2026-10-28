'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Negocio, Venta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { gananciaVenta } from '@/dominio/ganancia'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { IconoSincronizado } from '@/ui/sistema/iconos'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'

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
    <Hoja abierta onCerrar={onNueva} titulo={`Cobrado ${TEXTO_DEL_MEDIO[venta.medioPago]}`} etiquetaCerrar="Cerrar y empezar otra venta" ancho="angosto">
      <div className="f-cobrado">
        <span className="f-cobrado-icono" aria-hidden="true"><IconoSincronizado /></span>
        <strong className="f-plata-48">{formatearPesos(venta.total)}</strong>
        <p className="f-texto">Ganaste <b className="f-plata">{formatearPesos(gananciaVenta(venta))}</b> con esta venta</p>
      </div>
      <Boton variante="principal" tamano="grande" ancho onClick={onNueva} autoFocus>Nueva venta</Boton>
      <a href={link} target="_blank" rel="noopener noreferrer" className={clasesBoton('secundario', 'f-boton-ancho')}>
        Mandar el ticket por WhatsApp
      </a>
    </Hoja>
  )
}
