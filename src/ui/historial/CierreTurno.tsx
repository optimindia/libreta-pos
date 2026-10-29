'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { diferenciaCaja } from '@/dominio/caja'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { fechaLarga } from '@/dominio/comparar'
import { desdeDelTurno, resumenTurno, type ResumenTurno } from '@/dominio/turno'
import type { Cierre, UUID } from '@/dominio/tipos'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { Fila, Monto } from '@/ui/plata/CierreCaja'

/** El vendedor cierra SU turno: cuenta el efectivo y la app lo compara con
 *  lo que cobró él. No muestra ganancias ni costos, ni fondo ni movimientos
 *  manuales (eso es del dueño, en Plata). */
export function CierreTurno({ usuarioId }: { usuarioId: UUID }) {
  const [abierto, setAbierto] = useState(false)
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const [ventas, pagos, turnos] = await Promise.all([
      repos.ventas.todas(), repos.fiados.pagos(), repos.cierres.turnos(),
    ])
    const suyos = turnos.filter((c) => c.usuarioId === usuarioId)
    const desde = desdeDelTurno(suyos, usuarioId, ahora)
    return { resumen: resumenTurno(ventas, pagos, usuarioId, desde, ahora), ultimo: suyos[0] ?? null }
  }, [usuarioId])

  if (!datos) return null

  return (
    <div className="fh-turno">
      <Boton variante="secundario" ancho onClick={() => setAbierto(true)}>Cerrar mi turno</Boton>
      {datos.ultimo && <UltimoTurno cierre={datos.ultimo} />}
      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Cerrá tu turno">
        <PanelTurno resumen={datos.resumen} onTerminado={() => setAbierto(false)} />
      </Hoja>
    </div>
  )
}

function UltimoTurno({ cierre }: { cierre: Cierre }) {
  const diferencia = diferenciaCaja(cierre.contado, cierre.esperado)
  return (
    <p className="f-dato fh-turno-ultimo" data-tono={diferencia < 0 ? 'ambar' : 'verde'}>
      Último turno · {fechaLarga(new Date(cierre.fecha))} · {diferencia === 0 ? 'cuadró' : diferencia < 0 ? `faltó ${formatearPesos(-diferencia)}` : `sobró ${formatearPesos(diferencia)}`}
    </p>
  )
}

function PanelTurno({ resumen, onTerminado }: { resumen: ResumenTurno; onTerminado: () => void }) {
  const [contado, setContado] = useState('')
  const contadoCentavos = pesosACentavos(Number(contado) || 0)
  const diferencia = contado === '' ? null : diferenciaCaja(contadoCentavos, resumen.esperado)

  async function cerrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (contado === '' || contadoCentavos < 0) return
    await repos.cierres.registrarTurno({
      ventasEfectivo: resumen.ventasEfectivo,
      pagosFiadoEfectivo: resumen.pagosFiadoEfectivo,
      esperado: resumen.esperado,
      contado: contadoCentavos,
    })
    onTerminado()
  }

  return (
    <form className="fp-formulario" onSubmit={(evento) => void cerrar(evento)}>
      <p className="f-hoja-ayuda">Contá el efectivo que tenés de tus ventas y guardá el resultado.</p>
      <section className="fp-desglose" aria-label="Lo que debería haber de tus ventas">
        <h3 className="f-hoja-subtitulo">Lo que debería haber</h3>
        <dl>
          <Fila nombre="Tus ventas en efectivo"><Monto centavos={resumen.ventasEfectivo} /></Fila>
          <Fila nombre="Fiados que cobraste"><Monto centavos={resumen.pagosFiadoEfectivo} /></Fila>
          <Fila nombre="Esperado" fuerte><Monto centavos={resumen.esperado} /></Fila>
        </dl>
      </section>

      <label className="f-campo">
        <span>¿Cuánto contaste? <em>importe real</em></span>
        <span className="fp-prefijo">
          <span aria-hidden="true">$</span>
          <input aria-label="Contado en el cajón" inputMode="decimal" autoFocus placeholder="Ej. 5.000" className="f-entrada fp-entrada-grande tabular" value={contado} onChange={(evento) => setContado(evento.target.value)} />
        </span>
      </label>

      {diferencia !== null && (
        <div className="fp-diferencia" data-tono={diferencia < 0 ? 'ambar' : 'verde'}>
          <span>{diferencia === 0 ? 'La caja cuadra' : diferencia < 0 ? 'Te faltó' : 'Te sobró'}</span>
          <Monto centavos={Math.abs(diferencia)} />
        </div>
      )}

      <Boton type="submit" variante="principal" tamano="grande" ancho disabled={contado === ''}>
        Guardar cierre de turno
      </Boton>
    </form>
  )
}
