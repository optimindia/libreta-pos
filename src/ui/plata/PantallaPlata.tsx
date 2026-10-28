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
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
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

  return (
    <div className="page-plata px-5 pt-6">
      <div className="page-module-head plata-head">
        <div>
          <span className="page-kicker">Resumen financiero</span>
          <h1 className="page-title">Plata</h1>
          <div className="mt-1 text-[12px] font-semibold">{etiquetaPeriodo(periodo)}</div>
        </div>
        <a
          className="mz-boton-cabecera rounded-xl px-3 py-2 text-[12px] font-semibold"
          target="_blank"
          rel="noreferrer"
          href={enlaceWhatsApp('', mensajeResumen(etiquetaPeriodo(periodo), datos.resumen))}
        >
          Compartir resumen
        </a>
      </div>

      <CentroAcciones agotados={agotados} reposiciones={datos.compras.length} vencidos={vencidos} alertasMargen={alertasMargen} cierrePendiente={cierrePendiente} pendientesSync={nubeActiva() ? pendientesSync : 0} />

      <div className="plata-periodos nb-segmentado mt-3">
        {PERIODOS.map((opcion) => (
          <Boton
            key={opcion}
            variante={periodo === opcion ? 'principal' : 'secundario'}
            aria-pressed={periodo === opcion}
            onClick={() => setPeriodo(opcion)}
          >
            {ETIQUETA_PERIODO[opcion]}
          </Boton>
        ))}
      </div>

      <section className="nb-resumen-plata" aria-label="Resumen del período">
        <span className="nb-resumen-rotulo">Vendiste · {etiquetaPeriodo(periodo).toLowerCase()}</span>
        <Importe centavos={datos.resumen.vendido} className="nb-resumen-monto" />
        <span className="nb-resumen-detalle">{datos.resumen.cantidadVentas} {datos.resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}</span>
        <div className="nb-resumen-datos">
          <div><span>Ganaste</span><Importe centavos={datos.resumen.ganancia} className="nb-resumen-dato" /><small>{porcentajeMargen(datos.resumen.vendido, datos.resumen.ganancia)}% de margen</small></div>
          <div><span>Ticket promedio</span><Importe centavos={datos.resumen.ticketPromedio} className="nb-resumen-dato" /><small>por venta</small></div>
        </div>
      </section>

      <div className="plata-report-grid">
      <section className="plata-report-card">
      <h2 className="nb-tarjeta-titulo">Lo que más rindió</h2>
      {datos.ranking.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--tenue)' }}>Todavía no hay ventas en este período.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {datos.ranking.map((producto, indice) => (
            <li key={producto.productoId} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: indice === 0 ? 'var(--chip-fondo)' : 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
              <span className="tabular flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: 'var(--linea)', color: 'var(--tenue)' }}>{indice + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{producto.nombre}</div>
                <div className="text-[12px]" style={{ color: 'var(--tenue)' }}>{producto.unidades} unidades · ganancia {<Importe centavos={producto.ganancia} tamaño="chico" />}</div>
              </div>
              <Importe centavos={producto.vendido} tamaño="chico" />
            </li>
          ))}
        </ul>
      )}

      </section>
      <section className="plata-report-card">
      <h2 className="nb-tarjeta-titulo">Cómo te pagaron</h2>
      {medios.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--tenue)' }}>Todavía no cobraste en este período.</p>
      ) : (
        <ul className="nb-medios">
          {medios.map(([medio, monto]) => {
            const porcentaje = datos.resumen.porcentajePorMedio[medio as keyof typeof datos.resumen.porcentajePorMedio]
            return (
              <li key={medio}>
                <div className="nb-medios-fila">
                  <span>{NOMBRE_MEDIO[medio]}</span>
                  <span><small>{porcentaje}%</small><Importe centavos={monto} tamaño="chico" /></span>
                </div>
                <div className="nb-medios-barra" aria-hidden="true"><div style={{ width: `${Math.max(2, porcentaje)}%` }} /></div>
              </li>
            )
          })}
        </ul>
      )}

      </section>
      </div>

      <div className="plata-operations-grid">
      <section id="caja" className="plata-operation-card">
      <h2 className="nb-tarjeta-titulo">Caja</h2>
      <div className="mt-2"><CierreCaja /></div>
      <MovimientosCaja />
      </section>

      <section id="lista-compra" className="plata-operation-card">
      <InteligenciaPlata
        ventas={datos.ventas}
        productos={datos.productos}
        clientes={datos.clientes}
        periodo={periodo}
        resumen={datos.resumen}
      />
      </section>

      <section className="plata-operation-card">
      <h2 className="nb-tarjeta-titulo">Tenés que reponer</h2>
      {datos.compras.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--tenue)' }}>Por ahora no te falta nada.</p>
      ) : (
        <>
          <ul className="mt-2">
            {datos.compras.map((compra) => (
              <li key={compra.producto.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--linea)' }}>
                <div className="leading-tight"><div className="text-[13px] font-medium">{compra.producto.nombre}</div><div className="text-[12px]" style={{ color: 'var(--tenue)' }}>{textoDuracion(compra.diasRestantes)}</div></div>
                <span className="tabular text-[13px] font-semibold">{compra.cantidadSugerida}</span>
              </li>
            ))}
          </ul>
          <a className="mt-4 block rounded-2xl py-3.5 text-center text-[14px] font-semibold" style={{ background: 'var(--verde)', color: 'var(--verde-texto)' }} target="_blank" rel="noreferrer" href={enlaceWhatsApp('', mensajeCompra(datos.compras))}>
            Mandar pedido al proveedor
          </a>
        </>
      )}
      </section>
      </div>
    </div>
  )
}
