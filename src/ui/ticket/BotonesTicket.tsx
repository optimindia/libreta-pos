'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { textoPlanoTicket, type DatosTicket } from '@/dominio/ticketImpreso'
import { Boton } from '@/ui/sistema/Boton'
import { useTicket } from '@/ui/sistema/usoTicket'
import { TicketImpreso } from './TicketImpreso'

const sinSuscripcion = () => () => {}
const puedeCompartir = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** "Imprimir ticket" y, si el aparato sabe compartir, "Compartir". Los dos
 *  son secundarios: el botón lima de la pantalla es otro. El ticket se monta
 *  al primer toque, afuera del árbol de la app (en el body), para que el CSS
 *  de impresión pueda esconder todo lo demás. */
export function BotonesTicket({ datos }: { datos: Omit<DatosTicket, 'leyenda'> }) {
  const [preferencias] = useTicket()
  const [pedidos, setPedidos] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const sabeCompartir = useSyncExternalStore(sinSuscripcion, puedeCompartir, () => false)
  const completos: DatosTicket = { ...datos, leyenda: preferencias.leyenda }

  // Recién cuando el ticket ya está en el documento se abre la impresión.
  useEffect(() => {
    if (pedidos > 0) window.print()
  }, [pedidos])

  async function compartir() {
    setAviso(null)
    try {
      await navigator.share({ title: 'Ticket de compra', text: textoPlanoTicket(completos, preferencias.ancho) })
    } catch (error) {
      // Cerrar la hoja de compartir sin elegir nada no es un error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setAviso('No se pudo compartir el ticket. Probá de nuevo.')
    }
  }

  return (
    <>
      <div className="f-ticket-botones">
        <Boton variante="secundario" ancho onClick={() => setPedidos((n) => n + 1)}>Imprimir ticket</Boton>
        {sabeCompartir && <Boton variante="secundario" ancho onClick={() => void compartir()}>Compartir</Boton>}
      </div>
      {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
      {pedidos > 0 && createPortal(<TicketImpreso datos={completos} ancho={preferencias.ancho} />, document.body)}
    </>
  )
}
