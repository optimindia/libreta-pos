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
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Renglon } from '@/ui/sistema/Renglon'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

const DIA_EN_MS = 24 * 60 * 60 * 1000

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
    <Tarjeta como="section" className="fp-lectura fp-ancho" aria-labelledby="lectura-titulo">
      <h2 id="lectura-titulo" className="f-seccion">Lectura inteligente</h2>

      <div className="fp-pareja">
        <div className="fp-dato-caja">
          <span>Vs. período anterior</span>
          {comparacion ? (
            <>
              <b className="f-plata f-plata-16 fp-grande" data-tono={comparacion.porcentaje >= 0 ? 'verde' : 'ambar'}>{comparacion.porcentaje >= 0 ? '+' : ''}{comparacion.porcentaje}%</b>
              <small>{comparacion.ventasActuales} vs {comparacion.ventasAnteriores} ventas</small>
            </>
          ) : <b className="fp-sin-dato">Sin comparación</b>}
        </div>
        <div className="fp-dato-caja">
          <span>Pronóstico próximos días</span>
          <b className="f-plata f-plata-16 fp-grande">{formatearPesos(pronostico.proyectado)}</b>
          <small>confianza {pronostico.confianza} · {formatearPesos(pronostico.promedioDiario)}/día</small>
        </div>
      </div>

      <section className="fp-objetivo" aria-label="Objetivo diario">
        <h3 className="f-renglon-texto">Objetivo diario</h3>
        <label className="f-campo">
          <span>Meta de ventas <em>importe en pesos</em></span>
          <span className="fp-prefijo">
            <span aria-hidden="true">$</span>
            <input aria-label="Objetivo del período" inputMode="decimal" className="f-entrada fp-entrada-grande tabular" placeholder="Ej. 50.000" value={objetivo} onChange={(evento) => { setObjetivo(evento.target.value); window.localStorage.setItem('libreta-objetivo-periodo', evento.target.value) }} />
            <span className="fp-sufijo">/día</span>
          </span>
          <span className="f-dato">Se guarda solo en este dispositivo.</span>
        </label>
        {objetivoCentavos > 0 && (
          <div className="fp-progreso" data-cumplido={avance.cumplido ? 'true' : undefined}>
            <span className="fp-progreso-barra" aria-hidden="true"><span style={{ width: `${avance.porcentaje}%` }} /></span>
            <span className="fp-progreso-texto"><span>{avance.porcentaje}% cumplido</span><span>{avance.cumplido ? 'Objetivo cumplido' : `faltan ${formatearPesos(avance.restante)}`}</span></span>
          </div>
        )}
      </section>

      <section className="fp-tendencia" aria-label="Tendencia de ventas">
        <div className="fp-tendencia-cabeza"><h3 className="f-renglon-texto">Tendencia de ventas</h3><span className="f-dato">{puntos.length} días</span></div>
        <div className="fp-columnas">
          {puntos.map((punto) => (
            <div key={punto.fecha} className="fp-columna" title={`${punto.etiqueta}: ${formatearPesos(punto.vendido)}`}>
              <span style={{ height: `${Math.max(2, (punto.vendido / maximo) * 100)}%` }} data-vacia={punto.vendido > 0 ? undefined : 'true'} />
            </div>
          ))}
        </div>
        <div className="fp-tendencia-pie f-dato"><span>{puntos[0]?.etiqueta}</span><span>{puntos[puntos.length - 1]?.etiqueta}</span></div>
      </section>

      {topClientes.length > 0 && (
        <section aria-label="Clientes que más compran">
          <h3 className="f-renglon-texto">Clientes que más compran</h3>
          <ul className="fp-lista">
            {topClientes.map((cliente, indice) => (
              <Renglon
                key={cliente.clienteId}
                como="li"
                inicio={<span className="fp-puesto">{indice + 1}</span>}
                titulo={cliente.nombre}
                detalle={`${cliente.ventas} compras`}
                fin={<span className="f-renglon-fin">{formatearPesos(cliente.gastado)}</span>}
              />
            ))}
          </ul>
        </section>
      )}

      {(alertas.length > 0 || dormidos.length > 0) && (
        <section className="fp-alertas" aria-label="Alertas para decidir">
          <div className="fp-tendencia-cabeza"><h3 className="f-renglon-texto">Alertas para decidir</h3><Etiqueta tono="ambar">{alertas.length} con revisión</Etiqueta></div>
          {alertas.slice(0, 4).map(({ producto }) => {
            const rotacion = rotacionStock(producto, ventas, ahora)
            return (
              <div key={producto.id} className="fp-alerta">
                <span className="fp-alerta-fila"><span className="f-renglon-titulo">{producto.nombre}</span><span className="fp-alerta-margen">{margenProducto(producto)}% margen</span></span>
                <span className="f-renglon-detalle">{alertasProducto(producto).join(' · ')}{rotacion.diasCobertura !== null ? ` · ${rotacion.diasCobertura} días de cobertura` : ''}</span>
              </div>
            )
          })}
          {dormidos.length > 0 && (
            <>
              <h4 className="fp-subtitulo">Capital inmovilizado</h4>
              {dormidos.map((producto) => <div key={producto.id} className="fp-alerta-fila"><span className="f-texto">{producto.nombre}</span><span className="fp-alerta-margen">{producto.stock} sin rotación</span></div>)}
            </>
          )}
          {alertas.length > 4 && <p className="f-dato">Hay {alertas.length - 4} alertas más para revisar en Stock.</p>}
        </section>
      )}

      <Boton variante="secundario" ancho onClick={() => window.print()}>Imprimir esta lectura</Boton>
    </Tarjeta>
  )
}
