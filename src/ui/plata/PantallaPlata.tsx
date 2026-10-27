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

      <div className="plata-periodos mt-3 grid grid-cols-4 gap-1.5">
        {PERIODOS.map((opcion) => (
          <Boton
            key={opcion}
            variante={periodo === opcion ? 'principal' : 'secundario'}
            className="!rounded-xl !px-1 !py-2 !text-[12px]"
            aria-pressed={periodo === opcion}
            onClick={() => setPeriodo(opcion)}
          >
            {opcion === 'todo' ? 'Todo' : opcion === 'hoy' ? 'Hoy' : opcion}
          </Boton>
        ))}
      </div>

      <div className="plata-kpis mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl px-3.5 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
          <div className="text-[12px]" style={{ color: 'var(--tenue)' }}>Vendiste</div>
          <Importe centavos={datos.resumen.vendido} tamaño="grande" className="mt-0.5 !text-2xl" />
          <div className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>{datos.resumen.cantidadVentas} ventas</div>
        </div>
        <div className="rounded-2xl px-3.5 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
          <div className="text-[12px]" style={{ color: 'var(--tenue)' }}>Ganaste</div>
          <Importe centavos={datos.resumen.ganancia} tamaño="grande" className="mt-0.5 !text-2xl" style={{ color: 'var(--verde)' }} />
          <div className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>{porcentajeMargen(datos.resumen.vendido, datos.resumen.ganancia)}% de margen</div>
        </div>
      </div>

      <div className="plata-ticket mt-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
        <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>Ticket promedio</span>
        <Importe centavos={datos.resumen.ticketPromedio} tamaño="chico" />
      </div>

      <div className="plata-report-grid">
      <section className="plata-report-card">
      <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Lo que más rindió</h2>
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
      <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Cómo te pagaron</h2>
      {medios.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--tenue)' }}>Todavía no cobraste en este período.</p>
      ) : (
        <ul className="mt-2">
          {medios.map(([medio, monto]) => (
            <li key={medio} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--linea)' }}>
              <span className="text-[13px]">{NOMBRE_MEDIO[medio]}</span>
              <span className="flex items-center gap-2"><span className="text-[12px]" style={{ color: 'var(--tenue)' }}>{datos.resumen.porcentajePorMedio[medio as keyof typeof datos.resumen.porcentajePorMedio]}%</span><Importe centavos={monto} tamaño="chico" /></span>
            </li>
          ))}
        </ul>
      )}

      </section>
      </div>

      <div className="plata-operations-grid">
      <section id="caja" className="plata-operation-card">
      <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Caja</h2>
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
      <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Tenés que reponer</h2>
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
