'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Venta } from '@/dominio/tipos'
import { etiquetaPeriodo, filtrarVentas, rangoReporte, type PeriodoReporte } from '@/dominio/reportes'
import { normalizarTexto } from '@/dominio/validaciones'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { formatearPesos } from '@/dominio/dinero'
import { ErrorVentaNoAnulable, ErrorVentaYaAnulada, repos } from '@/datos/local/repos'
import { descargarCsv, ventasACsv } from '@/datos/local/csv'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoFlechaDerecha, IconoFlechaIzquierda, IconoHistorial } from '@/ui/sistema/iconos'
import { usePuede } from '@/ui/sistema/usoRol'
import { useIdentidad, type Identidad } from '@/ui/sistema/usoVendedor'
import { FiltroVendedor } from '@/ui/sistema/FiltroVendedor'
import { etiquetaVendedor, filtrarPorVendedor } from '@/dominio/turno'
import { CierreTurno } from './CierreTurno'

const ETIQUETA_PERIODO: Record<PeriodoReporte, string> = { hoy: 'Hoy', '7dias': '7 días', '30dias': '30 días', todo: 'Todo' }
const PERIODOS: PeriodoReporte[] = ['hoy', '7dias', '30dias', 'todo']

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', fiado: 'Fiado',
}

function fechaVenta(epoch: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(epoch))
}

function DetalleVenta({ venta, yo, onAnulada }: { venta: Venta; yo: Identidad; onAnulada: (venta: Venta) => void }) {
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const nombre = negocio?.nombre || 'Tu almacén'
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  // Anular devuelve stock y saca plata de la caja: es del dueño.
  const anula = usePuede('anularVentas')
  const anulada = venta.estado === 'anulada'

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
    <>
      <p className="f-hoja-ayuda">{fechaVenta(venta.fecha)} · {MEDIOS[venta.medioPago]}{anulada ? ' · Anulada' : ''}</p>
      <p className="f-hoja-ayuda">Vendió: {etiquetaVendedor(venta.vendidoPor, yo)}</p>
      {anulada && (
        <div className="f-aviso" data-tono="ambar">
          <strong>Venta anulada</strong>
          <span>{venta.motivoAnulacion || 'Sin motivo detallado'} · stock devuelto</span>
        </div>
      )}
      <ul className="fh-items">
        {venta.items.map((item) => (
          <li key={item.productoId} className="f-renglon">
            <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{item.cantidad} × {item.nombre}</span></span>
            <span className="f-renglon-fin">{formatearPesos(item.precio * item.cantidad)}</span>
          </li>
        ))}
      </ul>
      <div className="fh-total"><span>Total</span><span className="f-plata f-plata-36">{formatearPesos(venta.total)}</span></div>
      {venta.referenciaPago && <div className="fh-referencia"><span>Referencia de cobro</span><strong>{venta.referenciaPago}</strong></div>}

      {anula && confirmando && !anulada ? (
        <div className="fh-anular" role="group" aria-label="Anular venta">
          <h3 className="f-renglon-texto">¿Anular esta venta?</h3>
          <p className="f-hoja-ayuda">Se devuelve el stock y queda una salida de caja si fue en efectivo. La venta no se borra.</p>
          <label className="f-campo">
            <span>Motivo <em>recomendado</em></span>
            <input aria-label="Motivo de anulación" className="f-entrada" placeholder="Ej. producto equivocado" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} autoFocus />
          </label>
          <div className="fh-acciones">
            <Boton variante="cuidado" disabled={guardando} onClick={() => void anular()}>{guardando ? 'Anulando…' : 'Sí, anular venta'}</Boton>
            <Boton variante="secundario" onClick={() => setConfirmando(false)}>Volver</Boton>
          </div>
        </div>
      ) : anulada ? (
        <p className="f-hoja-ayuda">El comprobante queda sólo como registro interno.</p>
      ) : (
        <div className="fh-acciones" data-orden="columna">
          <a className={clasesBoton('principal')} target="_blank" rel="noreferrer" href={enlaceWhatsApp('', mensajeTicket({ id: 'unico', nombre, logo: null, color: null }, venta))}>
            Reenviar ticket por WhatsApp
          </a>
          {anula && <Boton variante="cuidado" onClick={() => { setConfirmando(true); setAviso(null) }}>Anular venta</Boton>}
        </div>
      )}
      {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
    </>
  )
}

export function PantallaHistorial() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionada, setSeleccionada] = useState<Venta | null>(null)
  const [vendedor, setVendedor] = useState<string | null>(null)
  const yo = useIdentidad()
  const todas = useLiveQuery(() => repos.ventas.todas(), [], [])
  // Hasta saber quién es no se muestra nada; el vendedor ve sólo lo suyo y
  // el filtro por vendedor es del dueño.
  const ventas = yo === null ? []
    : yo.rol === 'vendedor' ? (yo.usuarioId ? filtrarPorVendedor(todas, yo.usuarioId) : [])
    : filtrarPorVendedor(todas, vendedor)
  const aguja = normalizarTexto(busqueda)
  const filtradas = filtrarVentas(ventas, rangoReporte(periodo), true).filter((venta) => {
    if (aguja === '') return true
    return normalizarTexto(`${venta.medioPago} ${venta.items.map((item) => item.nombre).join(' ')}`).includes(aguja)
  })

  return (
    <div className="fh-pagina">
      <header className="fh-cabeza">
        <div className="fh-cabeza-texto">
          <Link href="/vender" className="fh-volver"><IconoFlechaIzquierda /> Vender</Link>
          <h1 className="f-titulo">Historial de ventas</h1>
        </div>
        <span className="f-dato fh-cuenta">{filtradas.length} {filtradas.length === 1 ? 'venta' : 'ventas'}</span>
      </header>

      <div className="fh-herramientas">
        <CampoBusqueda etiqueta="Buscar en historial" placeholder="Buscar producto o medio de pago…" valor={busqueda} onCambiar={setBusqueda} />
        <Chips etiqueta="Período">
          {PERIODOS.map((opcion) => (
            <Chip key={opcion} activo={periodo === opcion} onClick={() => setPeriodo(opcion)}>{ETIQUETA_PERIODO[opcion]}</Chip>
          ))}
        </Chips>
        {yo?.rol === 'dueno' && <FiltroVendedor filas={todas} valor={vendedor} onCambiar={setVendedor} yo={yo} />}
        {yo?.rol === 'vendedor' && yo.usuarioId && <CierreTurno usuarioId={yo.usuarioId} />}
        <Boton variante="secundario" className="fh-exportar" onClick={() => descargarCsv(`ventas-${new Date().toISOString().slice(0, 10)}.csv`, ventasACsv(filtradas))}>
          Exportar estas ventas a CSV
        </Boton>
      </div>

      {filtradas.length === 0 ? (
        ventas.length === 0 ? (
          <Tarjeta como="section" relleno="grande" className="fh-vacio" aria-labelledby="historial-empty-title">
            <span className="fh-vacio-icono" aria-hidden="true"><IconoHistorial /></span>
            <h2 id="historial-empty-title" className="f-seccion">Todavía no hay ventas</h2>
            <p className="f-texto">Las ventas cobradas van a quedar ordenadas acá para revisarlas y exportarlas cuando lo necesites.</p>
            <Link href="/vender" className={clasesBoton('principal')}>Ir a vender <IconoFlechaDerecha /></Link>
          </Tarjeta>
        ) : (
          <Tarjeta className="fh-vacio">
            <p className="f-texto">No hay ventas en {etiquetaPeriodo(periodo).toLowerCase()}.</p>
          </Tarjeta>
        )
      ) : (
        <Tarjeta como="section" relleno="ninguno" className="fh-lista-caja" aria-label="Ventas">
          <ul className="fh-lista">
            {filtradas.map((venta) => {
              const anulada = venta.estado === 'anulada'
              return (
                <li key={venta.id}>
                  <button type="button" className="fh-venta" onClick={() => setSeleccionada(venta)} aria-label={`Ver venta de ${ImporteLabel(venta.total)} de ${fechaVenta(venta.fecha)}`}>
                    <span className="fh-venta-cantidad" aria-hidden="true">{venta.items.length}</span>
                    <span className="f-renglon-cuerpo">
                      <span className="f-renglon-titulo" data-anulada={anulada ? 'true' : undefined}>{venta.items.map((item) => item.nombre).join(', ')}</span>
                      <span className="f-renglon-detalle">
                        {fechaVenta(venta.fecha)} · {MEDIOS[venta.medioPago]}
                        {anulada && <> · <Etiqueta tono="ambar" className="fh-anulada">Anulada</Etiqueta></>}
                      </span>
                    </span>
                    <span className="f-renglon-fin" data-anulada={anulada ? 'true' : undefined}>{formatearPesos(venta.total)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}

      <Hoja
        abierta={seleccionada !== null}
        onCerrar={() => setSeleccionada(null)}
        titulo="Detalle de venta"
        ancho="angosto"
      >
        {seleccionada && yo && <DetalleVenta venta={seleccionada} yo={yo} onAnulada={(venta) => setSeleccionada(venta)} />}
      </Hoja>
    </div>
  )
}

function ImporteLabel(centavos: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(centavos / 100)
}
