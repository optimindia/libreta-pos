'use client'

import { Segmentado } from '@/ui/sistema/Segmentado'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useTicket } from '@/ui/sistema/usoTicket'
import { LARGO_MAXIMO_LEYENDA, type AnchoPapel } from '@/dominio/ticketImpreso'

const OPCIONES: { valor: `${AnchoPapel}`; texto: string; nombre: string }[] = [
  { valor: '58', texto: '58 mm', nombre: 'Papel de 58 milímetros' },
  { valor: '80', texto: '80 mm', nombre: 'Papel de 80 milímetros' },
]

/** Cómo sale el ticket impreso: ancho del rollo y la frase del pie. Se
 *  guarda en este aparato apenas se cambia. */
export function TicketControl() {
  const [preferencias, cambiar] = useTicket()

  return (
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-ticket">
      <h2 id="config-ticket" className="f-seccion">Ticket impreso</h2>
      <Segmentado
        etiqueta="Ancho del papel"
        opciones={OPCIONES}
        valor={`${preferencias.ancho}`}
        onCambiar={(valor) => cambiar({ ancho: valor === '80' ? 80 : 58 })}
      />
      <label className="f-campo">
        <span>Frase al pie del ticket</span>
        <input
          aria-label="Frase al pie del ticket"
          className="f-entrada"
          maxLength={LARGO_MAXIMO_LEYENDA}
          value={preferencias.leyenda}
          onChange={(evento) => cambiar({ leyenda: evento.target.value })}
        />
        <small className="f-config-ayuda">Se guarda en este aparato. Vacía, el ticket sale sin frase.</small>
      </label>
    </Tarjeta>
  )
}
