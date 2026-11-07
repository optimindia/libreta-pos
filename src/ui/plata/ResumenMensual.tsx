'use client'

import './informe.css'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { formatearCantidad } from '@/dominio/cantidad'
import { formatearPesos } from '@/dominio/dinero'
import { NOMBRE_MEDIO } from '@/dominio/pagos'
import { mesesDisponibles, resumenMensual, type ResumenMensual as Datos } from '@/dominio/resumenMensual'
import type { MedioPago } from '@/dominio/tipos'
import { Boton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'

function Informe({ datos, negocio }: { datos: Datos; negocio: string }) {
  const mayorDia = Math.max(1, ...datos.porDia.map((dia) => dia.monto))
  const medios = (Object.keys(datos.porMedio) as MedioPago[]).filter((medio) => datos.porMedio[medio] > 0)
  return (
    <article className="f-informe">
      <header className="f-informe-cabeza">
        <div>
          <p className="f-informe-negocio">{negocio}</p>
          <h1>Resumen de {datos.titulo}</h1>
        </div>
        <p className="f-informe-fecha">Hecho con Libreta</p>
      </header>

      <section className="f-informe-numeros">
        <div><span>Vendiste</span><strong>{formatearPesos(datos.vendido)}</strong><small>{datos.contraMesAnterior === null ? `${datos.cantidadVentas} ventas` : `${datos.contraMesAnterior >= 0 ? '+' : ''}${datos.contraMesAnterior}% vs. el mes anterior`}</small></div>
        <div><span>Ventas</span><strong>{datos.cantidadVentas}</strong><small>ticket promedio {formatearPesos(datos.ticketPromedio)}</small></div>
        <div><span>Ganancia de las ventas</span><strong>{formatearPesos(datos.ganancia)}</strong><small>margen {datos.margen}%</small></div>
        <div><span>Te quedó</span><strong data-negativo={datos.queda < 0 ? 'true' : undefined}>{datos.queda < 0 ? '−' : ''}{formatearPesos(Math.abs(datos.queda))}</strong><small>después de gastos</small></div>
      </section>

      <section className="f-informe-bloque">
        <h2>Ventas por día</h2>
        <div className="f-informe-barras" aria-hidden="true">
          {datos.porDia.map((dia) => (
            <span key={dia.dia} data-mejor={datos.mejorDia?.dia === dia.dia ? 'true' : undefined} style={{ height: `${Math.max(2, Math.round((dia.monto / mayorDia) * 100))}%` }} />
          ))}
        </div>
        <div className="f-informe-dias" aria-hidden="true"><span>1</span><span>{Math.ceil(datos.porDia.length / 2)}</span><span>{datos.porDia.length}</span></div>
        {datos.mejorDia && <p className="f-informe-nota">Mejor día: el {datos.mejorDia.dia}, con {formatearPesos(datos.mejorDia.monto)}.</p>}
      </section>

      <div className="f-informe-columnas">
        <section className="f-informe-bloque">
          <h2>Lo más vendido</h2>
          {datos.masVendidos.length === 0 ? <p className="f-informe-nota">Sin ventas.</p> : (
            <table>
              <thead><tr><th>Producto</th><th>Cant.</th><th>Vendido</th></tr></thead>
              <tbody>
                {datos.masVendidos.map((producto) => (
                  <tr key={producto.nombre}><td>{producto.nombre}</td><td>{formatearCantidad(producto.cantidad)}</td><td>{formatearPesos(producto.monto)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="f-informe-bloque">
          <h2>Cómo te pagaron</h2>
          <table>
            <tbody>
              {medios.map((medio) => <tr key={medio}><td>{NOMBRE_MEDIO[medio]}</td><td>{formatearPesos(datos.porMedio[medio])}</td></tr>)}
              {datos.cobradoDeFiados > 0 && <tr><td>Cobrado de fiados</td><td>{formatearPesos(datos.cobradoDeFiados)}</td></tr>}
            </tbody>
          </table>
          <h2>Gastos</h2>
          <table>
            <tbody>
              <tr><td>Gastos de caja</td><td>{formatearPesos(datos.gastosCaja)}</td></tr>
              <tr><td>Gastos fijos</td><td>{formatearPesos(datos.gastosFijos)}</td></tr>
            </tbody>
          </table>
          {datos.anulaciones > 0 && <p className="f-informe-nota">{datos.anulaciones} {datos.anulaciones === 1 ? 'venta anulada' : 'ventas anuladas'} (no suman).</p>}
        </section>
      </div>
    </article>
  )
}

/** Botón y hoja para elegir el mes y guardarlo como PDF (o imprimirlo). */
export function ResumenMensual() {
  const [abierto, setAbierto] = useState(false)
  const [elegido, setElegido] = useState(0)
  const [imprimiendo, setImprimiendo] = useState(0)
  const [ahora] = useState(() => Date.now())
  const [ajustes] = useAjustesNegocio()
  const fuentes = useLiveQuery(async () => {
    if (!abierto) return null
    const [ventas, movimientos, pagos, negocio] = await Promise.all([
      repos.ventas.todas(), db.movimientosCaja.toArray(), repos.fiados.pagos(), db.negocio.get('unico'),
    ])
    return { ventas, movimientos, pagos, nombre: negocio?.nombre?.trim() || 'Tu almacén' }
  }, [abierto], null)

  useEffect(() => {
    if (imprimiendo > 0) window.print()
  }, [imprimiendo])

  const meses = fuentes ? mesesDisponibles(fuentes.ventas, ahora) : []
  const mes = meses[elegido]
  const datos = fuentes && mes ? resumenMensual(fuentes.ventas, fuentes.movimientos, fuentes.pagos, ajustes.gastosFijos ?? [], mes.anio, mes.mes) : null

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)}>Resumen del mes en PDF</Boton>
      {abierto && createPortal(
      <Hoja abierta onCerrar={() => setAbierto(false)} titulo="Resumen del mes">
        <div className="f-informe-controles">
          <label className="f-campo">
            <span>Mes</span>
            <select aria-label="Mes del resumen" className="f-entrada" value={elegido} onChange={(evento) => setElegido(Number(evento.target.value))}>
              {meses.map((opcion, i) => <option key={`${opcion.anio}-${opcion.mes}`} value={i}>{opcion.titulo.charAt(0).toUpperCase() + opcion.titulo.slice(1)}</option>)}
            </select>
          </label>
          <Boton variante="principal" disabled={!datos} onClick={() => setImprimiendo((n) => n + 1)}>Guardar PDF o imprimir</Boton>
        </div>
        <p className="f-dato">En la ventana de impresión elegí «Guardar como PDF» para tenerlo en el celu o mandarlo por WhatsApp.</p>
        {datos && fuentes && <div className="f-informe-papel"><Informe datos={datos} negocio={fuentes.nombre} /></div>}
      </Hoja>,
      document.body,
      )}
      {imprimiendo > 0 && datos && fuentes && createPortal(
        <div className="f-informe-impreso" aria-hidden="true">
          <style>{'@page { size: A4; margin: 12mm; }'}</style>
          <Informe datos={datos} negocio={fuentes.nombre} />
        </div>,
        document.body,
      )}
    </>
  )
}
