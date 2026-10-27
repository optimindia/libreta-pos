'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Venta } from '@/dominio/tipos'
import { etiquetaPeriodo, filtrarVentas, rangoReporte, type PeriodoReporte } from '@/dominio/reportes'
import { normalizarTexto } from '@/dominio/validaciones'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { ErrorVentaNoAnulable, ErrorVentaYaAnulada, repos } from '@/datos/local/repos'
import { descargarCsv, ventasACsv } from '@/datos/local/csv'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { IconoFlechaDerecha, IconoFlechaIzquierda, IconoHistorial } from '@/ui/sistema/iconos'

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', fiado: 'Fiado',
}

function fechaVenta(epoch: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(epoch))
}

function DetalleVenta({ venta, onCerrar, onAnulada }: { venta: Venta; onCerrar: () => void; onAnulada: (venta: Venta) => void }) {
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const nombre = negocio?.nombre || 'Tu almacén'
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function anular() {
    setGuardando(true)
    setAviso(null)
    try {
      const actualizada = await repos.ventas.anular(venta.id, motivo)
      onAnulada(actualizada)
      setConfirmando(false)
      setMotivo('')
    } catch (error) {
      if (error instanceof ErrorVentaYaAnulada || error instanceof ErrorVentaNoAnulable) setAviso(error.message)
      else setAviso('No se pudo anular la venta. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl px-3.5 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
      <div className="flex items-baseline justify-between">
        <div><h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Detalle de venta</h2><div className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>{fechaVenta(venta.fecha)} · {MEDIOS[venta.medioPago]}{venta.estado === 'anulada' ? ' · Anulada' : ''}</div></div>
        <button type="button" className="text-[12px]" style={{ color: 'var(--tenue)' }} onClick={onCerrar}>Cerrar</button>
      </div>
      {venta.estado === 'anulada' && <div className="history-void-banner"><strong>Venta anulada</strong><span>{venta.motivoAnulacion || 'Sin motivo detallado'} · stock devuelto</span></div>}
      <ul className="mt-3">
        {venta.items.map((item) => (
          <li key={item.productoId} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--linea)' }}>
            <span className="text-[13px]">{item.cantidad} × {item.nombre}</span>
            <Importe centavos={item.precio * item.cantidad} tamaño="chico" />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between"><span className="text-[12px] font-semibold">Total</span><Importe centavos={venta.total} tamaño="normal" /></div>
      {venta.referenciaPago && <div className="history-payment-reference"><span>Referencia de cobro</span><strong>{venta.referenciaPago}</strong></div>}
      {venta.estado !== 'anulada' && <button type="button" className="history-void-button" onClick={() => { setConfirmando(true); setAviso(null) }}>Anular venta</button>}
      {confirmando && venta.estado !== 'anulada' && (
        <div className="history-void-form form-shell form-card">
          <div className="form-section-heading"><span className="form-step">!</span><div><h3>¿Anular esta venta?</h3><p>Se devuelve el stock y queda una salida de caja si fue en efectivo. La venta no se borra.</p></div></div>
          <label className="form-field"><span className="form-field-label">Motivo <em>recomendado</em></span><input aria-label="Motivo de anulación" className="form-input" placeholder="Ej. producto equivocado" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} autoFocus /></label>
          <div className="form-actions"><button type="button" className="history-void-confirm" disabled={guardando} onClick={() => void anular()}>{guardando ? 'Anulando…' : 'Sí, anular venta'}</button><button type="button" className="history-void-cancel" onClick={() => setConfirmando(false)}>Volver</button></div>
        </div>
      )}
      {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
      {venta.estado === 'anulada' ? (
        <p className="history-void-note">El comprobante queda sólo como registro interno.</p>
      ) : (
        <a className="mt-3 block rounded-2xl py-3 text-center text-[13px] font-semibold" style={{ background: 'var(--verde)', color: 'var(--verde-texto)' }} target="_blank" rel="noreferrer" href={enlaceWhatsApp('', mensajeTicket({ id: 'unico', nombre, logo: null, color: null }, venta))}>
          Reenviar ticket por WhatsApp
        </a>
      )}
    </div>
  )
}

export function PantallaHistorial() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionada, setSeleccionada] = useState<Venta | null>(null)
  const ventas = useLiveQuery(() => repos.ventas.todas(), [], [])
  const aguja = normalizarTexto(busqueda)
  const filtradas = filtrarVentas(ventas, rangoReporte(periodo), true).filter((venta) => {
    if (aguja === '') return true
    return normalizarTexto(`${venta.medioPago} ${venta.items.map((item) => item.nombre).join(' ')}`).includes(aguja)
  })

  return (
    <div className="page-historial px-5 pt-6">
      <div className="page-module-head historial-head">
        <div><Link href="/" className="history-back-link" style={{ color: 'var(--verde)' }}><IconoFlechaIzquierda /> Vender</Link><span className="page-kicker mt-3 block">Registro</span><h1 className="page-title">Historial de ventas</h1></div>
        <span className="tabular text-[12px]" style={{ color: 'var(--tenue)' }}>{filtradas.length} ventas</span>
      </div>
      <input aria-label="Buscar en historial" placeholder="Buscar producto o medio de pago…" className="historial-search mt-4 w-full rounded-xl px-3 py-2.5 text-[14px]" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }} value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
      <div className="historial-filters mt-2 grid grid-cols-4 gap-1.5">
        {(['hoy', '7dias', '30dias', 'todo'] as PeriodoReporte[]).map((opcion) => (
          <Boton key={opcion} variante={periodo === opcion ? 'principal' : 'secundario'} className="!rounded-xl !px-1 !py-2 !text-[12px]" onClick={() => setPeriodo(opcion)}>{opcion === 'todo' ? 'Todo' : opcion === 'hoy' ? 'Hoy' : opcion}</Boton>
        ))}
      </div>
      <button type="button" className="historial-export mt-2 w-full rounded-xl py-2.5 text-[12px] font-semibold" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }} onClick={() => descargarCsv(`ventas-${new Date().toISOString().slice(0, 10)}.csv`, ventasACsv(filtradas))}>Exportar estas ventas a CSV</button>
      <div className={`historial-layout${seleccionada ? ' historial-layout-detail' : ''}`}>
      {seleccionada && <DetalleVenta venta={seleccionada} onCerrar={() => setSeleccionada(null)} onAnulada={(venta) => setSeleccionada(venta)} />}
      {filtradas.length === 0 ? (
        ventas.length === 0 ? (
          <section className="historial-empty-state" aria-labelledby="historial-empty-title">
            <span className="historial-empty-icon" aria-hidden="true"><IconoHistorial /></span>
            <span className="historial-empty-kicker">Registro en blanco</span>
            <h2 id="historial-empty-title">Todavía no hay ventas</h2>
            <p>Las ventas cobradas van a quedar ordenadas acá para revisarlas y exportarlas cuando lo necesites.</p>
            <Link href="/" className="historial-empty-action">Ir a vender <IconoFlechaDerecha /></Link>
          </section>
        ) : (
          <p className="py-14 text-center text-[13px]" style={{ color: 'var(--tenue)' }}>No hay ventas en {etiquetaPeriodo(periodo).toLowerCase()}.</p>
        )
      ) : (
        <ul className="mt-4">
          {filtradas.map((venta) => (
            <li key={venta.id}>
              <button type="button" className="historial-row flex w-full items-center gap-3 py-3 text-left active:opacity-70" style={{ borderBottom: '1px solid var(--linea)' }} onClick={() => setSeleccionada(venta)} aria-label={`Ver venta de ${ImporteLabel(venta.total)} de ${fechaVenta(venta.fecha)}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold" style={{ background: 'var(--chip-fondo)', color: 'var(--tenue)' }}>{venta.items.length}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium" style={{ textDecoration: venta.estado === 'anulada' ? 'line-through' : undefined }}>{venta.items.map((item) => item.nombre).join(', ')}</span><span className="text-[12px]" style={{ color: venta.estado === 'anulada' ? 'var(--ambar)' : 'var(--tenue)' }}>{fechaVenta(venta.fecha)} · {MEDIOS[venta.medioPago]}{venta.estado === 'anulada' ? ' · Anulada' : ''}</span></span>
                <Importe centavos={venta.total} tamaño="chico" style={{ color: venta.estado === 'anulada' ? 'var(--tenue)' : undefined, textDecoration: venta.estado === 'anulada' ? 'line-through' : undefined }} />
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}

function ImporteLabel(centavos: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(centavos / 100)
}
