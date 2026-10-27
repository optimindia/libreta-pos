'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { resumenDelDia } from '@/dominio/ganancia'
import { deudaPorCliente } from '@/dominio/fiado'
import { fechaLarga, compararConLaSemanaPasada } from '@/dominio/comparar'
import { hayPendientes } from '@/datos/local/cola'
import { Importe } from '@/ui/sistema/Importe'
import { ChipEstado } from '@/ui/sistema/ChipEstado'
import { IconoConfig, IconoHistorial } from '@/ui/sistema/iconos'
import { EstadoConexion } from '@/ui/sistema/EstadoConexion'

const DIAS_ATRAS = 'mismo día de la semana pasada'

export function Cabecera() {
  const datos = useLiveQuery(async () => {
    const [ventas, fiados, pagos, negocio, pendientes] = await Promise.all([
      repos.ventas.todas(),
      db.fiados.toArray(),
      repos.fiados.pagos(),
      db.negocio.toCollection().first(),
      hayPendientes(),
    ])
    const ahora = Date.now()
    const deudas = deudaPorCliente(fiados, pagos, ahora)
    return {
      resumen: resumenDelDia(ventas, new Date(ahora)),
      contraSemanaPasada: compararConLaSemanaPasada(ventas, new Date(ahora)),
      teDeben: deudas.reduce((total, deuda) => total + deuda.saldo, 0),
      negocio,
      pendientes,
    }
  }, [])

  if (!datos) {
    return (
      <header className="app-header app-header-loading" aria-busy="true">
        <span className="app-loading-bar app-loading-bar-short" />
        <span className="app-loading-value" />
        <span className="app-loading-card" />
      </header>
    )
  }

  const inicial = datos.negocio?.nombre?.trim().charAt(0).toUpperCase() ?? 'L'

  return (
    <header className="app-header px-5 pt-5">
      <div className="app-header-top flex items-center gap-2.5">
        {datos.negocio?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={datos.negocio.logo} alt="" className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
            style={{ background: datos.negocio?.color ?? 'var(--hueso)', color: datos.negocio?.color ? 'var(--verde-texto)' : 'var(--verde)' }}
          >
            {inicial}
          </div>
        )}
        <div className="flex-1 leading-tight">
          <div className="text-[13px] font-semibold">{datos.negocio?.nombre ?? 'Tu almacén'}</div>
          <div className="text-[11px]" style={{ color: 'var(--tenue)' }}>
            {fechaLarga(new Date())}
          </div>
        </div>
        <ChipEstado pendientes={datos.pendientes} />
        <EstadoConexion />
        <Link
          href="/historial"
          aria-label="Historial de ventas"
          title="Historial de ventas"
          className="flex h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
          style={{ color: 'var(--tenue)', border: '1px solid var(--linea)', background: 'var(--hueso-2)' }}
        >
          <IconoHistorial />
        </Link>
        <Link
          href="/config"
          aria-label="Configuración"
          title="Configuración"
          className="flex h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
          style={{ color: 'var(--tenue)', border: '1px solid var(--linea)', background: 'var(--hueso-2)' }}
        >
          <IconoConfig />
        </Link>
      </div>

      <div className="app-header-metric mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
          Vendido hoy
        </div>
        <Importe centavos={datos.resumen.vendido} tamaño="grande" />
        {datos.contraSemanaPasada !== null && (
          <div className="app-header-delta mt-0.5 text-[11.5px]" style={{ color: 'var(--tenue)' }}>
            {datos.contraSemanaPasada >= 0
              ? `${datos.contraSemanaPasada}% más`
              : `${Math.abs(datos.contraSemanaPasada)}% menos`}{' '}
            que el {DIAS_ATRAS}
          </div>
        )}
      </div>

      <div
        className="app-header-kpis mt-4 flex overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--linea)', background: 'var(--hueso-2)' }}
      >
        <div className="flex-1 px-3 py-2.5">
          <div className="text-[10.5px]" style={{ color: 'var(--tenue)' }}>Ganancia</div>
          <Importe centavos={datos.resumen.ganancia} className="text-[17px]" style={{ color: 'var(--verde)' }} />
        </div>
        <div style={{ width: 1, background: 'var(--linea)' }} />
        <div className="flex-1 px-3 py-2.5">
          <div className="text-[10.5px]" style={{ color: 'var(--tenue)' }}>Te deben</div>
          <Importe centavos={datos.teDeben} className="text-[17px]" style={{ color: 'var(--ambar)' }} />
        </div>
      </div>
    </header>
  )
}
