'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nuevoId } from '@/dominio/id'
import type { Venta } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { gananciaRealDelMes } from '@/dominio/gananciaReal'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'

/** Lo que de verdad queda en el mes: lo que dejaron las ventas, menos los
 *  gastos sueltos de caja y los gastos fijos que carga el dueño. */
export function GananciaReal({ ventas }: { ventas: Venta[] }) {
  const [ajustes, cambiarAjustes] = useAjustesNegocio()
  const movimientos = useLiveQuery(() => db.movimientosCaja.toArray(), [], [])
  const [ahora] = useState(() => Date.now())
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const gastos = ajustes.gastosFijos ?? []
  const r = gananciaRealDelMes(ventas, movimientos, gastos, ahora)
  const positivo = r.queda >= 0

  function agregar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const centavos = pesosACentavos(Number(monto.replace(/\./g, '').replace(',', '.')) || 0)
    if (!nombre.trim() || centavos <= 0) return
    cambiarAjustes({ gastosFijos: [...gastos, { id: nuevoId(), nombre: nombre.trim(), monto: centavos }] })
    setNombre('')
    setMonto('')
  }

  return (
    <Tarjeta como="section" className="fp-real fp-ancho" aria-labelledby="real-titulo">
      <div className="fp-real-cabeza">
        <div>
          <h2 id="real-titulo" className="f-seccion">Ganancia real de {r.mes}</h2>
          <p className="f-dato">Lo que te queda después de los gastos.</p>
        </div>
        <strong className="f-plata fp-real-total" data-tono={positivo ? 'verde' : 'coral'}>
          {positivo ? '' : '−'}{formatearPesos(Math.abs(r.queda))}
        </strong>
      </div>

      <dl className="fp-real-cuentas">
        <div><dt>Dejaron las ventas</dt><dd className="f-plata">{formatearPesos(r.gananciaBruta)}</dd></div>
        <div><dt>Gastos de caja del mes</dt><dd className="f-plata">−{formatearPesos(r.gastosCaja)}</dd></div>
        <div><dt>Gastos fijos</dt><dd className="f-plata">−{formatearPesos(r.gastosFijos)}</dd></div>
        <div className="fp-real-queda"><dt>Te queda</dt><dd className="f-plata">{positivo ? '' : '−'}{formatearPesos(Math.abs(r.queda))}</dd></div>
      </dl>

      {r.equilibrioDiario !== null ? (
        <p className="fp-real-equilibrio">
          Para cubrir los gastos fijos tenés que vender <strong className="f-plata">{formatearPesos(r.equilibrioDiario)} por día</strong>
          {' '}(con tu margen de {Math.round(r.margen * 100)}%).
        </p>
      ) : (
        <p className="f-dato">{gastos.length === 0 ? 'Cargá tus gastos fijos para ver cuánto tenés que vender por día.' : 'Cuando vendas, te decimos cuánto tenés que vender por día.'}</p>
      )}

      {editando ? (
        <div className="fp-fijos">
          {gastos.length > 0 && (
            <ul className="fp-fijos-lista">
              {gastos.map((gasto) => (
                <li key={gasto.id}>
                  <span>{gasto.nombre}</span>
                  <strong className="f-plata">{formatearPesos(gasto.monto)}</strong>
                  <button type="button" className="fp-fijos-quitar" aria-label={`Quitar ${gasto.nombre}`} onClick={() => cambiarAjustes({ gastosFijos: gastos.filter((g) => g.id !== gasto.id) })}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
          <form className="fp-fijos-form" onSubmit={agregar}>
            <input aria-label="Nombre del gasto fijo" className="f-entrada" placeholder="Ej. Alquiler" value={nombre} onChange={(evento) => setNombre(evento.target.value)} />
            <input aria-label="Monto por mes" inputMode="decimal" className="f-entrada" placeholder="$ por mes" value={monto} onChange={(evento) => setMonto(evento.target.value)} />
            <Boton type="submit" variante="secundario">Agregar</Boton>
          </form>
          <Boton variante="secundario" onClick={() => setEditando(false)}>Listo</Boton>
        </div>
      ) : (
        <Boton variante="secundario" onClick={() => setEditando(true)}>
          {gastos.length === 0 ? 'Cargar gastos fijos' : `Gastos fijos (${gastos.length})`}
        </Boton>
      )}
    </Tarjeta>
  )
}
