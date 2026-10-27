'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Negocio, Venta } from '@/dominio/tipos'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'

/** El cierre de la venta: el importe cobrado y el ticket a mano para
 *  mandarlo por WhatsApp. Si la venta lleva un cliente con teléfono,
 *  el link abre directo su chat; si no, el almacenero elige el chat. */
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
    <div
      className="vender-receipt mx-5 mt-3 rounded-xl px-4 py-4"
      style={{ background: 'var(--chip-fondo)' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
          Cobrado
        </span>
        <Importe centavos={venta.total} tamaño="grande" className="!text-2xl" style={{ color: 'var(--verde)' }} />
      </div>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-2xl px-4 py-3 text-center text-[13px] font-semibold transition-opacity active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--verde)]"
        style={{ background: 'var(--verde)', color: 'var(--verde-texto)' }}
      >
        Mandar el ticket por WhatsApp
      </a>
      <Boton
        variante="secundario"
        className="mt-2 w-full !py-3 !text-[13px]"
        onClick={onNueva}
      >
        Nueva venta
      </Boton>
    </div>
  )
}
