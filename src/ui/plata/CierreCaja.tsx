'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { diferenciaCaja, esperadoEnCaja, movimientosEfectivo } from '@/dominio/caja'
import { resumenDelDia } from '@/dominio/ganancia'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { fechaLarga } from '@/dominio/comparar'
import { mensajeCierre, enlaceWhatsApp } from '@/dominio/mensajes'
import { repos } from '@/datos/local/repos'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'

/** Cuadrar la caja: la app dice cuánto debería haber, el almacenero
 *  cuenta y la diferencia queda registrada. Se hace en una hoja: el
 *  teclado no tapa nada y la pantalla de Plata queda donde estaba. */
export function CierreCaja() {
  const [abierto, setAbierto] = useState(false)
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const ultimo = await repos.cierres.ultimo()
    const desde = ultimo?.fecha ?? 0
    const [ventas, pagos, cierres, movimientosCaja] = await Promise.all([
      repos.ventas.todas(),
      repos.fiados.pagos(),
      repos.cierres.todos(),
      repos.movimientosCaja.todos(),
    ])
    return {
      fondoSugerido: ultimo?.contado ?? 0,
      movimientos: movimientosEfectivo(ventas, pagos, desde, ahora, movimientosCaja),
      resumen: resumenDelDia(ventas, new Date(ahora)),
      cierres,
    }
  }, [])

  if (!datos) return null

  return (
    <div className="fp-cierre">
      <Boton variante="secundario" ancho onClick={() => setAbierto(true)}>
        Cerrar caja
      </Boton>
      {datos.cierres.length > 0 && <Historial cierres={datos.cierres.slice(0, 5)} />}
      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Cuadrá tu caja">
        <PanelCierre
          movimientos={datos.movimientos}
          fondoSugerido={datos.fondoSugerido}
          resumen={datos.resumen}
          onTerminado={() => setAbierto(false)}
        />
      </Hoja>
    </div>
  )
}

function PanelCierre({
  movimientos,
  fondoSugerido,
  resumen,
  onTerminado,
}: {
  movimientos: { ventasEfectivo: number; pagosFiadoEfectivo: number; entradasCaja?: number; salidasCaja?: number }
  fondoSugerido: number
  resumen: { vendido: number; ganancia: number }
  onTerminado: () => void
}) {
  const [fondo, setFondo] = useState((fondoSugerido / 100).toString())
  const [contado, setContado] = useState('')

  const fondoInicial = pesosACentavos(Number(fondo) || 0)
  const contadoCentavos = pesosACentavos(Number(contado) || 0)
  const esperado = esperadoEnCaja(fondoInicial, movimientos)
  const diferencia = contado === '' ? null : diferenciaCaja(contadoCentavos, esperado)

  async function cerrar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    if (contado === '' || contadoCentavos < 0) return
    await repos.cierres.registrar({
      fondoInicial,
      ventasEfectivo: movimientos.ventasEfectivo,
      pagosFiadoEfectivo: movimientos.pagosFiadoEfectivo,
      entradasCaja: movimientos.entradasCaja ?? 0,
      salidasCaja: movimientos.salidasCaja ?? 0,
      esperado,
      contado: contadoCentavos,
    })
    onTerminado()
  }

  return (
    <form className="fp-formulario" onSubmit={(evento) => void cerrar(evento)}>
      <p className="f-hoja-ayuda">Revisá el cálculo, contá el efectivo y guardá el resultado.</p>

      <section className="fp-desglose" aria-label="Lo que debería haber">
        <h3 className="f-hoja-subtitulo">Lo que debería haber</h3>
        <dl>
          <Fila nombre="Fondo inicial">
            <input
              aria-label="Fondo inicial" inputMode="decimal"
              placeholder="Ej. 5.000"
              className="f-entrada fp-entrada-chica tabular"
              value={fondo}
              onChange={(evento) => setFondo(evento.target.value)}
            />
          </Fila>
          <Fila nombre="Ventas en efectivo"><Monto centavos={movimientos.ventasEfectivo} /></Fila>
          <Fila nombre="Pagos de fiado"><Monto centavos={movimientos.pagosFiadoEfectivo} /></Fila>
          {(movimientos.entradasCaja ?? 0) > 0 && <Fila nombre="Entradas manuales"><Monto centavos={movimientos.entradasCaja ?? 0} /></Fila>}
          {(movimientos.salidasCaja ?? 0) > 0 && <Fila nombre="Salidas manuales"><Monto centavos={-(movimientos.salidasCaja ?? 0)} /></Fila>}
          <Fila nombre="Esperado" fuerte><Monto centavos={esperado} /></Fila>
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
        Guardar cierre
      </Boton>

      {diferencia !== null && (
        <a
          className={clasesBoton('secundario')}
          target="_blank"
          rel="noreferrer"
          href={enlaceWhatsApp('', mensajeCierre({
            vendido: resumen.vendido,
            ganancia: resumen.ganancia,
            contado: contadoCentavos,
            diferencia,
          }))}
        >
          Mandar el resumen por WhatsApp
        </a>
      )}
    </form>
  )
}

function Monto({ centavos }: { centavos: number }) {
  return <span className="f-plata f-plata-16">{formatearPesos(centavos)}</span>
}

function Fila({
  nombre, fuerte, children,
}: { nombre: string; fuerte?: boolean; children: React.ReactNode }) {
  return (
    <div className="fp-fila" data-fuerte={fuerte ? 'true' : undefined}>
      <dt>{nombre}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Historial({ cierres }: { cierres: { id: string; fecha: number; contado: number; esperado: number }[] }) {
  return (
    <section aria-label="Últimos cierres">
      <h3 className="fp-subtitulo">Últimos cierres</h3>
      <ul className="fp-lista">
        {cierres.map((cierre) => {
          const diferencia = diferenciaCaja(cierre.contado, cierre.esperado)
          return (
            <li key={cierre.id} className="f-renglon">
              <span className="f-renglon-cuerpo">
                <span className="f-renglon-titulo">{fechaLarga(new Date(cierre.fecha))}</span>
                <span className="f-renglon-detalle">{diferencia === 0 ? 'Cuadró' : diferencia < 0 ? 'Faltó' : 'Sobró'}</span>
              </span>
              <span className="f-renglon-fin" data-tono={diferencia < 0 ? 'ambar' : 'verde'}>{formatearPesos(Math.abs(diferencia))}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
