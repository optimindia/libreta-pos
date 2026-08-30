'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { diferenciaCaja, esperadoEnCaja, movimientosEfectivo } from '@/dominio/caja'
import { resumenDelDia } from '@/dominio/ganancia'
import { pesosACentavos } from '@/dominio/dinero'
import { fechaLarga } from '@/dominio/comparar'
import { mensajeCierre, enlaceWhatsApp } from '@/dominio/mensajes'
import { repos } from '@/datos/local/repos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

/** Cuadrar la caja: la app dice cuánto debería haber, el almacenero
 *  cuenta y la diferencia queda registrada. */
export function CierreCaja() {
  const [abierto, setAbierto] = useState(false)
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const ultimo = await repos.cierres.ultimo()
    const desde = ultimo?.fecha ?? 0
    const [ventas, pagos, cierres] = await Promise.all([
      repos.ventas.todas(),
      repos.fiados.pagos(),
      repos.cierres.todos(),
    ])
    return {
      fondoSugerido: ultimo?.contado ?? 0,
      movimientos: movimientosEfectivo(ventas, pagos, desde, ahora),
      resumen: resumenDelDia(ventas, new Date(ahora)),
      cierres,
    }
  }, [])

  if (!datos) return null
  if (!abierto) {
    return (
      <div>
        <Boton variante="secundario" className="w-full" onClick={() => setAbierto(true)}>
          Cerrar caja
        </Boton>
        {datos.cierres.length > 0 && <Historial cierres={datos.cierres.slice(0, 5)} />}
      </div>
    )
  }

  return (
    <PanelCierre
      movimientos={datos.movimientos}
      fondoSugerido={datos.fondoSugerido}
      resumen={datos.resumen}
      onTerminado={() => setAbierto(false)}
    />
  )
}

function PanelCierre({
  movimientos,
  fondoSugerido,
  resumen,
  onTerminado,
}: {
  movimientos: { ventasEfectivo: number; pagosFiadoEfectivo: number }
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

  async function cerrar() {
    if (contado === '' || contadoCentavos < 0) return
    await repos.cierres.registrar({
      fondoInicial,
      ventasEfectivo: movimientos.ventasEfectivo,
      pagosFiadoEfectivo: movimientos.pagosFiadoEfectivo,
      esperado,
      contado: contadoCentavos,
    })
    onTerminado()
  }

  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        En el cajón debería haber
      </h3>
      <dl className="mt-2 text-[13px]">
        <Fila nombre="Fondo inicial">
          <input
            aria-label="Fondo inicial" inputMode="decimal"
            className="tabular w-28 rounded-lg px-2 py-1 text-right text-[13px]"
            style={campo}
            value={fondo}
            onChange={(evento) => setFondo(evento.target.value)}
          />
        </Fila>
        <Fila nombre="Ventas en efectivo"><Importe centavos={movimientos.ventasEfectivo} tamaño="chico" /></Fila>
        <Fila nombre="Pagos de fiado"><Importe centavos={movimientos.pagosFiadoEfectivo} tamaño="chico" /></Fila>
        <Fila nombre="Esperado" fuerte>
          <Importe centavos={esperado} tamaño="normal" />
        </Fila>
      </dl>

      <label className="mt-4 block text-[12px]" style={{ color: 'var(--tenue)' }}>
        ¿Cuánto contaste?
        <input
          aria-label="Contado en el cajón" inputMode="decimal" autoFocus
          className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[16px]"
          style={campo}
          value={contado}
          onChange={(evento) => setContado(evento.target.value)}
        />
      </label>

      {diferencia !== null && (
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>
            {diferencia === 0 ? 'La caja cuadra' : diferencia < 0 ? 'Te faltó' : 'Te sobró'}
          </span>
          <Importe
            centavos={Math.abs(diferencia)}
            tamaño="normal"
            style={{ color: diferencia === 0 || diferencia > 0 ? 'var(--verde)' : 'var(--ambar)' }}
          />
        </div>
      )}

      <Boton variante="principal" className="mt-4 w-full" disabled={contado === ''} onClick={cerrar}>
        Guardar cierre
      </Boton>

      {diferencia !== null && (
        <a
          className="mt-2 block rounded-2xl py-3 text-center text-[13px] font-semibold"
          style={{ border: '1px solid var(--linea)', color: 'var(--tinta)' }}
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
    </div>
  )
}

function Fila({
  nombre, fuerte, children,
}: { nombre: string; fuerte?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-1.5"
      style={{ borderBottom: fuerte ? 'none' : '1px solid var(--linea)' }}
    >
      <dt style={{ color: 'var(--tenue)' }}>{nombre}</dt>
      <dd className={fuerte ? 'mt-1' : ''}>{children}</dd>
    </div>
  )
}

function Historial({ cierres }: { cierres: { id: string; fecha: number; contado: number; esperado: number }[] }) {
  return (
    <>
      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Últimos cierres
      </h3>
      <ul className="mt-2">
        {cierres.map((cierre) => {
          const diferencia = diferenciaCaja(cierre.contado, cierre.esperado)
          return (
            <li
              key={cierre.id}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: '1px solid var(--linea)' }}
            >
              <span className="text-[12.5px]" style={{ color: 'var(--tenue)' }}>
                {fechaLarga(new Date(cierre.fecha))}
              </span>
              <Importe
                centavos={Math.abs(diferencia)}
                tamaño="chico"
                style={{ color: diferencia === 0 || diferencia > 0 ? 'var(--verde)' : 'var(--ambar)' }}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}