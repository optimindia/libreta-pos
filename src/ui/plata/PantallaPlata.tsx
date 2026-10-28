'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { repos } from '@/datos/local/repos'
import { listaDeCompra } from '@/dominio/reposicion'
import { etiquetaPeriodo, rankingProductos, porcentajeMargen, resumenPeriodo, type PeriodoReporte } from '@/dominio/reportes'
import { mensajeCompra, mensajeResumen, enlaceWhatsApp } from '@/dominio/mensajes'
import { textoDuracion } from '@/dominio/comparar'
import { formatearPesos } from '@/dominio/dinero'
import { clasesBoton } from '@/ui/sistema/Boton'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Renglon } from '@/ui/sistema/Renglon'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { CierreCaja } from './CierreCaja'
import { MovimientosCaja } from './MovimientosCaja'
import { InteligenciaPlata } from './InteligenciaPlata'
import { CentroAcciones } from './CentroAcciones'
import { estadoVencimiento } from '@/dominio/inteligencia'
import { CargandoPagina } from '@/ui/sistema/CargandoPagina'

const ETIQUETA_PERIODO: Record<PeriodoReporte, string> = { hoy: 'Hoy', '7dias': '7 días', '30dias': '30 días', todo: 'Todo' }

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', fiado: 'Fiado',
}
/** Qué color lleva cada medio: efectivo y billetera son plata que entró; el fiado es plata que te deben. */
const TONO_MEDIO: Record<string, 'verde' | 'tinta' | 'coral'> = { efectivo: 'verde', transferencia: 'tinta', qr: 'tinta', fiado: 'coral' }
const PERIODOS: PeriodoReporte[] = ['hoy', '7dias', '30dias', 'todo']

export function PantallaPlata() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('hoy')
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const [ventas, productos, clientes] = await Promise.all([
      repos.ventas.todas(),
      repos.productos.todos(),
      repos.clientes.todos(),
    ])
    const [fiados, ultimoCierre] = await Promise.all([
      repos.fiados.abiertos(),
      repos.cierres.ultimo(),
    ])
    return {
      ahora,
      resumen: resumenPeriodo(ventas, periodo, ahora),
      ranking: rankingProductos(ventas, periodo, ahora).slice(0, 3),
      compras: listaDeCompra(productos, ventas, ahora),
      ventas,
      productos,
      clientes,
      fiados,
      ultimoCierre,
    }
  }, [periodo])
  const pendientesSync = useLiveQuery(() => db.cola.count(), [], 0)

  if (!datos) return <CargandoPagina texto="Preparando tu resumen financiero…" />
  const medios = Object.entries(datos.resumen.porMedioPago).filter(([, monto]) => monto > 0)
  const inicioHoy = new Date()
  inicioHoy.setHours(0, 0, 0, 0)
  const cierrePendiente = datos.ventas.some((venta) => venta.fecha >= inicioHoy.getTime()) && (!datos.ultimoCierre || datos.ultimoCierre.fecha < inicioHoy.getTime())
  const agotados = datos.productos.filter((producto) => producto.stock <= 0).length
  const alertasMargen = datos.productos.filter((producto) => producto.costo <= 0 || producto.precio <= 0 || producto.precio < producto.costo).length
  const vencidos = datos.fiados.filter((fiado) => estadoVencimiento(fiado.vence, datos.ahora) === 'vencido').length

  const ganancia = datos.resumen.ganancia

  return (
    <div className="fp-pagina">
      <header className="fp-cabeza">
        <div className="fp-cabeza-texto">
          <h1 className="f-titulo">Plata</h1>
          <p className="f-dato">{etiquetaPeriodo(periodo)}</p>
        </div>
        <a
          className={clasesBoton('secundario', 'fp-compartir')}
          target="_blank"
          rel="noreferrer"
          href={enlaceWhatsApp('', mensajeResumen(etiquetaPeriodo(periodo), datos.resumen))}
        >
          Compartir resumen
        </a>
      </header>

      <Chips etiqueta="Período" className="fp-periodos">
        {PERIODOS.map((opcion) => (
          <Chip key={opcion} activo={periodo === opcion} onClick={() => setPeriodo(opcion)}>
            {ETIQUETA_PERIODO[opcion]}
          </Chip>
        ))}
      </Chips>

      <div className="fp-grilla">
        <CentroAcciones agotados={agotados} reposiciones={datos.compras.length} vencidos={vencidos} alertasMargen={alertasMargen} cierrePendiente={cierrePendiente} pendientesSync={nubeActiva() ? pendientesSync : 0} />

        <Tarjeta como="section" className="fp-resumen fp-ancho" aria-label="Resumen del período">
          <div className="fp-resumen-principal">
            <span className="f-dato">Vendiste · {etiquetaPeriodo(periodo).toLowerCase()}</span>
            <span className="f-plata f-plata-48 fp-monto">{formatearPesos(datos.resumen.vendido)}</span>
            <span className="f-texto fp-resumen-detalle">{datos.resumen.cantidadVentas} {datos.resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}</span>
          </div>
          <div className="fp-resumen-datos">
            <div className="fp-dato-caja" data-tono={ganancia > 0 ? 'verde' : undefined}>
              <span>Ganaste</span>
              <b className="f-plata f-plata-36 fp-dato-monto">{formatearPesos(ganancia)}</b>
              <small>{porcentajeMargen(datos.resumen.vendido, ganancia)}% de margen</small>
            </div>
            <div className="fp-dato-caja">
              <span>Ticket promedio</span>
              <b className="f-plata f-plata-36 fp-dato-monto">{formatearPesos(datos.resumen.ticketPromedio)}</b>
              <small>por venta</small>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta como="section" aria-labelledby="plata-rindio">
          <h2 id="plata-rindio" className="f-seccion">Lo que más rindió</h2>
          {datos.ranking.length === 0 ? (
            <p className="f-dato fp-vacio">Todavía no hay ventas en este período.</p>
          ) : (
            <ul className="fp-lista">
              {datos.ranking.map((producto, indice) => (
                <Renglon
                  key={producto.productoId}
                  como="li"
                  inicio={<span className="fp-puesto" data-primero={indice === 0 ? 'true' : undefined}>{indice + 1}</span>}
                  titulo={producto.nombre}
                  detalle={`${producto.unidades} ${producto.unidades === 1 ? 'unidad' : 'unidades'} · ganancia ${formatearPesos(producto.ganancia)}`}
                  fin={<span className="f-renglon-fin">{formatearPesos(producto.vendido)}</span>}
                />
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta como="section" aria-labelledby="plata-pagaron">
          <h2 id="plata-pagaron" className="f-seccion">Cómo te pagaron</h2>
          {medios.length === 0 ? (
            <p className="f-dato fp-vacio">Todavía no cobraste en este período.</p>
          ) : (
            <ul className="fp-medios">
              {medios.map(([medio, monto]) => {
                const porcentaje = datos.resumen.porcentajePorMedio[medio as keyof typeof datos.resumen.porcentajePorMedio]
                return (
                  <li key={medio} className="fp-medio" data-tono={TONO_MEDIO[medio]}>
                    <span className="fp-medio-fila">
                      <span className="f-texto">{NOMBRE_MEDIO[medio]}</span>
                      <span className="fp-medio-monto"><small>{porcentaje}%</small><span className="f-plata f-plata-16">{formatearPesos(monto)}</span></span>
                    </span>
                    <span className="fp-medio-barra" aria-hidden="true"><span style={{ width: `${Math.max(2, porcentaje)}%` }} /></span>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta como="section" id="caja" aria-labelledby="plata-caja">
          <h2 id="plata-caja" className="f-seccion">Caja</h2>
          <CierreCaja />
          <MovimientosCaja />
        </Tarjeta>

        <Tarjeta como="section" id="lista-compra" aria-labelledby="plata-reponer">
          <h2 id="plata-reponer" className="f-seccion">Tenés que reponer</h2>
          {datos.compras.length === 0 ? (
            <p className="f-dato fp-vacio">Por ahora no te falta nada.</p>
          ) : (
            <>
              <ul className="fp-lista">
                {datos.compras.map((compra) => (
                  <Renglon
                    key={compra.producto.id}
                    como="li"
                    titulo={compra.producto.nombre}
                    detalle={textoDuracion(compra.diasRestantes)}
                    fin={<span className="f-renglon-fin">{compra.cantidadSugerida}</span>}
                  />
                ))}
              </ul>
              <a className={clasesBoton('principal', 'fp-pedido')} target="_blank" rel="noreferrer" href={enlaceWhatsApp('', mensajeCompra(datos.compras))}>
                Mandar pedido al proveedor
              </a>
            </>
          )}
        </Tarjeta>

        <InteligenciaPlata
          ventas={datos.ventas}
          productos={datos.productos}
          clientes={datos.clientes}
          periodo={periodo}
          resumen={datos.resumen}
        />
      </div>
    </div>
  )
}
