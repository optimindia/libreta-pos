'use client'

import { useState } from 'react'
import type { Cliente, Producto, Venta } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import {
  alertasProducto,
  compararPeriodos,
  clientesValiosos,
  margenProducto,
  productosDormidos,
  productosConAlertas,
  progresoObjetivo,
  pronosticoVentas,
  rotacionStock,
  serieVentas,
} from '@/dominio/inteligencia'
import { rangoReporte, type PeriodoReporte, type ResumenPeriodo } from '@/dominio/reportes'
import { Boton } from '@/ui/sistema/Boton'
import { Importe } from '@/ui/sistema/Importe'
import { IconoEfectivo } from '@/ui/sistema/iconos'

const DIA_EN_MS = 24 * 60 * 60 * 1000

function colorCambio(porcentaje: number): string {
  return porcentaje >= 0 ? 'var(--verde)' : 'var(--ambar)'
}

/** Panel de decisiones: convierte los datos del POS en acciones concretas. */
export function InteligenciaPlata({
  ventas,
  productos,
  clientes,
  periodo,
  resumen,
}: {
  ventas: Venta[]
  productos: Producto[]
  clientes: Cliente[]
  periodo: PeriodoReporte
  resumen: ResumenPeriodo
}) {
  const [ahora] = useState(() => Date.now())
  const pronostico = pronosticoVentas(ventas, ahora, periodo === '30dias' ? 30 : 14, periodo === 'hoy' ? 7 : 14)
  const puntos = serieVentas(ventas, periodo === '30dias' ? 30 : 14, ahora)
  const maximo = Math.max(1, ...puntos.map((punto) => punto.vendido))
  const topClientes = clientesValiosos(ventas, clientes).slice(0, 5)
  const alertas = productosConAlertas(productos)
  const dormidos = productosDormidos(productos, ventas, ahora).slice(0, 4)
  const [objetivo, setObjetivo] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('libreta-objetivo-periodo') ?? ''
  })

  const comparacion = periodo === 'todo' ? null : (() => {
    const rango = rangoReporte(periodo, ahora)
    const duracion = periodo === 'hoy' ? DIA_EN_MS : rango.hasta - rango.desde + 1
    return compararPeriodos(ventas, rango.desde, rango.hasta, rango.desde - duracion, rango.desde - 1)
  })()
  const objetivoCentavos = Math.round((Number(objetivo) || 0) * 100)
  const avance = progresoObjetivo(resumen.vendido, objetivoCentavos)

  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Lectura inteligente</h2>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
          <div className="text-[10.5px]" style={{ color: 'var(--tenue)' }}>Vs. período anterior</div>
          {comparacion ? (
            <>
              <div className="mt-1 text-xl font-bold" style={{ color: colorCambio(comparacion.porcentaje) }}>{comparacion.porcentaje >= 0 ? '+' : ''}{comparacion.porcentaje}%</div>
              <div className="text-[10px]" style={{ color: 'var(--tenue)' }}>{comparacion.ventasActuales} vs {comparacion.ventasAnteriores} ventas</div>
            </>
          ) : <div className="mt-1 text-[13px] font-semibold">Sin comparación</div>}
        </div>
        <div className="rounded-2xl px-3 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
          <div className="text-[10.5px]" style={{ color: 'var(--tenue)' }}>Pronóstico próximos días</div>
          <div className="mt-1 text-[16px] font-bold">{formatearPesos(pronostico.proyectado)}</div>
          <div className="text-[10px]" style={{ color: 'var(--tenue)' }}>confianza {pronostico.confianza} · {formatearPesos(pronostico.promedioDiario)}/día</div>
        </div>
      </div>

      <section className="form-section intelligence-goal-form mt-2">
        <div className="form-section-heading">
          <span className="form-step"><IconoEfectivo /></span>
          <div><h3>Objetivo diario</h3><p>Definí cuánto querés vender por día. Se guarda solo en este dispositivo.</p></div>
        </div>
        <label className="form-field">
          <span className="form-field-label">Meta de ventas <em>importe en pesos</em></span>
          <div className="goal-input-row"><span aria-hidden="true">$</span><input aria-label="Objetivo del período" inputMode="decimal" className="form-input form-input-large tabular" placeholder="Ej. 50.000" value={objetivo} onChange={(evento) => { setObjetivo(evento.target.value); window.localStorage.setItem('libreta-objetivo-periodo', evento.target.value) }} /><span>/día</span></div>
          <span className="form-field-help">Podés cambiarlo cuando quieras; el progreso se actualiza al instante.</span>
        </label>
        {objetivoCentavos > 0 && <><div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--linea)' }}><div className="h-full rounded-full" style={{ width: `${avance.porcentaje}%`, background: avance.cumplido ? 'var(--verde)' : 'var(--ambar)' }} /></div><div className="mt-1 flex justify-between text-[10.5px]" style={{ color: 'var(--tenue)' }}><span>{avance.porcentaje}% cumplido</span><span>{avance.cumplido ? 'Objetivo cumplido' : `faltan ${formatearPesos(avance.restante)}`}</span></div></>}
      </section>

      <div className="mt-2 rounded-2xl px-3 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
        <div className="flex items-baseline justify-between"><div className="text-[12px] font-semibold">Tendencia de ventas</div><span className="text-[10px]" style={{ color: 'var(--tenue)' }}>{puntos.length} días</span></div>
        <div className="mt-3 flex h-24 items-end gap-1">
          {puntos.map((punto) => <div key={punto.fecha} className="group flex h-full flex-1 flex-col justify-end" title={`${punto.etiqueta}: ${formatearPesos(punto.vendido)}`}><div className="min-h-[2px] rounded-t-sm" style={{ height: `${Math.max(2, (punto.vendido / maximo) * 100)}%`, background: punto.vendido > 0 ? 'var(--verde)' : 'var(--linea)' }} /></div>)}
        </div>
        <div className="mt-1 flex justify-between text-[9px]" style={{ color: 'var(--tenue)' }}><span>{puntos[0]?.etiqueta}</span><span>{puntos[puntos.length - 1]?.etiqueta}</span></div>
      </div>

      {topClientes.length > 0 && <div className="mt-2 rounded-2xl px-3 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
        <h3 className="text-[12px] font-semibold">Clientes que más compran</h3>
        <ul className="mt-2">{topClientes.map((cliente, indice) => <li key={cliente.clienteId} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid var(--linea)' }}><span className="tabular w-4 text-[11px]" style={{ color: 'var(--tenue)' }}>{indice + 1}</span><span className="min-w-0 flex-1 truncate text-[12px]">{cliente.nombre}<span className="ml-1 text-[10px]" style={{ color: 'var(--tenue)' }}>{cliente.ventas} compras</span></span><Importe centavos={cliente.gastado} tamaño="chico" /></li>)}</ul>
      </div>}

      {(alertas.length > 0 || dormidos.length > 0) && <div className="mt-2 rounded-2xl px-3 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
        <div className="flex items-baseline justify-between"><h3 className="text-[12px] font-semibold">Alertas para decidir</h3><span className="text-[10px]" style={{ color: 'var(--tenue)' }}>{alertas.length} productos con revisión</span></div>
        {alertas.slice(0, 4).map(({ producto }) => { const rotacion = rotacionStock(producto, ventas, ahora); return <div key={producto.id} className="mt-2 rounded-xl px-2.5 py-2" style={{ background: 'var(--chip-fondo)' }}><div className="flex justify-between gap-2"><span className="truncate text-[11.5px] font-medium">{producto.nombre}</span><span className="shrink-0 text-[10px]" style={{ color: producto.precio < producto.costo ? 'var(--ambar)' : 'var(--tenue)' }}>{margenProducto(producto)}% margen</span></div><div className="mt-0.5 text-[10px]" style={{ color: 'var(--tenue)' }}>{alertasProducto(producto).join(' · ')}{rotacion.diasCobertura !== null ? ` · ${rotacion.diasCobertura} días de cobertura` : ''}</div></div> })}
        {dormidos.length > 0 && <><div className="mt-3 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Capital inmovilizado</div>{dormidos.map((producto) => <div key={producto.id} className="mt-1 flex justify-between text-[11px]"><span className="truncate">{producto.nombre}</span><span style={{ color: 'var(--ambar)' }}>{producto.stock} sin rotación</span></div>)}</>}
        {alertas.length > 4 && <p className="mt-2 text-[10.5px]" style={{ color: 'var(--tenue)' }}>Hay {alertas.length - 4} alertas más para revisar en Stock.</p>}
      </div>}

      <Boton variante="secundario" className="mt-2 w-full !py-2.5 !text-[11px]" onClick={() => window.print()}>Imprimir esta lectura</Boton>
    </section>
  )
}
