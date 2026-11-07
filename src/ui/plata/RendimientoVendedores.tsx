'use client'

import { useState } from 'react'
import { formatearPesos } from '@/dominio/dinero'
import { etiquetaVendedor, SIN_DATO } from '@/dominio/turno'
import type { Venta } from '@/dominio/tipos'
import { rendimientoPorVendedor, comisionValida, type ConfigVendedores } from '@/dominio/vendedores'
import { Boton } from '@/ui/sistema/Boton'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'
import type { Identidad } from '@/ui/sistema/usoVendedor'

type Periodo = 'hoy' | 'semana' | 'mes'

function desdeDe(periodo: Periodo, ahora: number): number {
  const fecha = new Date(ahora)
  if (periodo === 'hoy') return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()
  if (periodo === 'semana') return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - 6).getTime()
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1).getTime()
}

/** Cuánto vende cada uno, qué parte del total hace y cuánto le toca de
 *  comisión. Sólo el dueño. Los nombres y comisiones los anota el dueño. */
export function RendimientoVendedores({ ventas, yo }: { ventas: Venta[]; yo: Identidad }) {
  const [ajustes, cambiar] = useAjustesNegocio()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ahora] = useState(() => Date.now())
  const [editando, setEditando] = useState(false)
  const config = ajustes.vendedores ?? {}
  const filas = rendimientoPorVendedor(ventas, desdeDe(periodo, ahora), ahora, config)
  const todos = rendimientoPorVendedor(ventas, 0, ahora, config).map((fila) => fila.vendedor).filter((id) => id !== SIN_DATO)
  // Con un solo vendedor (el dueño) no hay nada que comparar.
  if (todos.length < 2) return null
  const totalComisiones = filas.reduce((total, fila) => total + fila.comision, 0)

  return (
    <Tarjeta como="section" className="fp-rendimiento fp-ancho" aria-labelledby="rendimiento-titulo">
      <div className="fp-rendimiento-cabeza">
        <div>
          <h2 id="rendimiento-titulo" className="f-seccion">Rendimiento por vendedor</h2>
          <p className="f-dato">{totalComisiones > 0 ? `Comisiones del período: ${formatearPesos(totalComisiones)}` : 'Anotá nombres y comisiones para calcular lo que le toca a cada uno.'}</p>
        </div>
        <Boton variante="secundario" onClick={() => setEditando(true)}>Nombres y comisiones</Boton>
      </div>
      <Chips etiqueta="Período del rendimiento">
        <Chip activo={periodo === 'hoy'} onClick={() => setPeriodo('hoy')}>Hoy</Chip>
        <Chip activo={periodo === 'semana'} onClick={() => setPeriodo('semana')}>7 días</Chip>
        <Chip activo={periodo === 'mes'} onClick={() => setPeriodo('mes')}>Este mes</Chip>
      </Chips>
      {filas.length === 0 ? (
        <p className="f-dato">Sin ventas en este período.</p>
      ) : (
        <ul className="fp-rendimiento-lista">
          {filas.map((fila) => (
            <li key={fila.vendedor}>
              <div className="fp-rendimiento-fila">
                <span className="fp-rendimiento-nombre">
                  <strong>{etiquetaVendedor(fila.vendedor, yo, config)}</strong>
                  <span>{fila.cantidadVentas} {fila.cantidadVentas === 1 ? 'venta' : 'ventas'} · ticket {formatearPesos(fila.ticketPromedio)}</span>
                </span>
                <span className="fp-rendimiento-montos">
                  <strong className="f-plata">{formatearPesos(fila.vendido)}</strong>
                  {fila.comision > 0 && <span>Comisión {formatearPesos(fila.comision)} ({fila.porcentajeComision}%)</span>}
                </span>
              </div>
              <div className="fp-rendimiento-barra" role="img" aria-label={`${fila.participacion}% de lo vendido`}>
                <span style={{ width: `${Math.max(2, fila.participacion)}%` }} />
                <em>{fila.participacion}%</em>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando && <EditarVendedores ids={todos} config={config} yo={yo} onCerrar={() => setEditando(false)} onGuardar={(nuevo) => { cambiar({ vendedores: nuevo }); setEditando(false) }} />}
    </Tarjeta>
  )
}

function EditarVendedores({ ids, config, yo, onCerrar, onGuardar }: { ids: string[]; config: ConfigVendedores; yo: Identidad; onCerrar: () => void; onGuardar: (config: ConfigVendedores) => void }) {
  const [valores, setValores] = useState(() => Object.fromEntries(ids.map((id) => [id, { nombre: config[id]?.nombre ?? '', comision: config[id]?.comision ? String(config[id]?.comision) : '' }])))
  const [aviso, setAviso] = useState<string | null>(null)

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const salida: ConfigVendedores = {}
    for (const id of ids) {
      const { nombre, comision } = valores[id]
      const numero = comision.trim() === '' ? 0 : Number(comision.replace(',', '.'))
      if (comision.trim() !== '' && comisionValida(numero) === 0) {
        setAviso('La comisión va de 0,1% a 50%. Dejala vacía si no cobra comisión.')
        return
      }
      if (nombre.trim() || numero) salida[id] = { ...(nombre.trim() ? { nombre: nombre.trim().slice(0, 40) } : {}), ...(numero ? { comision: comisionValida(numero) } : {}) }
    }
    onGuardar(salida)
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Nombres y comisiones" ancho="angosto">
      <form className="fp-vendedores-form" onSubmit={guardar}>
        <p className="f-hoja-ayuda">La comisión es un porcentaje de lo que vende cada uno.</p>
        {ids.map((id) => (
          <fieldset key={id} className="fp-vendedores-campos">
            <legend>{etiquetaVendedor(id, yo, config)}</legend>
            <input aria-label={`Nombre de ${etiquetaVendedor(id, yo, config)}`} className="f-entrada" placeholder="Nombre" maxLength={40} value={valores[id].nombre} onChange={(evento) => setValores({ ...valores, [id]: { ...valores[id], nombre: evento.target.value } })} />
            <span className="fp-vendedores-pct">
              <input aria-label={`Comisión de ${etiquetaVendedor(id, yo, config)}`} inputMode="decimal" className="f-entrada" placeholder="0" value={valores[id].comision} onChange={(evento) => { setValores({ ...valores, [id]: { ...valores[id], comision: evento.target.value } }); setAviso(null) }} />
              <span aria-hidden="true">%</span>
            </span>
          </fieldset>
        ))}
        {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
        <Boton type="submit" variante="principal" ancho>Guardar</Boton>
      </form>
    </Hoja>
  )
}
