'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MedioPago, UUID } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos, vuelto } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { IconoEfectivo, IconoQR, IconoTransferencia, IconoNuevoCliente } from '@/ui/sistema/iconos'

const MEDIOS: { medio: MedioPago; texto: string }[] = [
  { medio: 'transferencia', texto: 'Transferencia' },
  { medio: 'qr', texto: 'QR' },
]

/** Cobro en efectivo: pregunta con cuánto pagó y calcula el vuelto
 *  antes de confirmar. Los otros medios cobran directo. */
function Efectivo({
  total,
  onCobrar,
  onVolver,
  onCancelar,
}: {
  total: number
  onCobrar: () => void
  onVolver: () => void
  onCancelar: () => void
}) {
  const [pagoCon, setPagoCon] = useState('')
  const entregado = pesosACentavos(Number(pagoCon) || 0)
  const resto = vuelto(entregado, total)
  const hayPago = pagoCon.trim() !== ''

  return (
    <form className="vender-payment-flow form-shell px-5 pt-2" onSubmit={(evento) => { evento.preventDefault(); if (pagoCon !== '' && resto >= 0) onCobrar() }}>
      <div className="vender-payment-heading">
        <div><span>Forma de cobro</span><strong>Efectivo · {formatearPesos(total)}</strong></div>
        <button type="button" className="vender-payment-cancel" onClick={onCancelar}>Cancelar</button>
      </div>
      <div className="form-callout payment-total-callout">
        <span>Total de la venta</span>
        <strong>{formatearPesos(total)}</strong>
      </div>
      <label className="form-field">
        <span className="form-field-label">¿Con cuánto pagó? <em>efectivo recibido</em></span>
        <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input
          aria-label="Con cuánto pagó" inputMode="decimal" autoFocus placeholder="Ej. 5.000"
          className="form-input tabular form-input-large"
          value={pagoCon}
          onChange={(evento) => setPagoCon(evento.target.value)}
        /></div>
        <span className="form-field-help">Escribí el total que te entrega el cliente y calculamos el vuelto.</span>
      </label>

      <div className="payment-change-card">
        <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>Vuelto</span>
        <span className="tabular text-2xl font-bold" style={{ color: 'var(--verde)' }}>
          {hayPago && resto >= 0 ? formatearPesos(resto) : '—'}
        </span>
      </div>
      {hayPago && resto < 0 && (
        <p className="mt-1 text-[12px]" style={{ color: 'var(--ambar)' }}>
          Le faltan {formatearPesos(-resto)} para cubrir la venta.
        </p>
      )}

      <Boton
        type="submit"
        variante="principal"
        className="w-full"
        disabled={pagoCon === '' || resto < 0}
      >
        Cobrar {formatearPesos(total)}
      </Boton>
      <Boton type="button" variante="secundario" className="w-full !py-3 !text-[13px]" onClick={onVolver}>
        Volver a medios de pago
      </Boton>
    </form>
  )
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function CobroDigital({
  medio,
  total,
  onCobrar,
  onVolver,
  onCancelar,
}: {
  medio: 'transferencia' | 'qr'
  total: number
  onCobrar: (referencia?: string) => void
  onVolver: () => void
  onCancelar: () => void
}) {
  const [confirmado, setConfirmado] = useState(false)
  const [referencia, setReferencia] = useState('')
  const nombre = medio === 'qr' ? 'QR' : 'Transferencia'

  return (
    <form className="vender-payment-flow form-shell px-5 pt-2" onSubmit={(evento) => { evento.preventDefault(); if (confirmado) onCobrar(referencia) }}>
      <div className="vender-payment-heading">
        <div><span>Forma de cobro</span><strong>{nombre} · {formatearPesos(total)}</strong></div>
        <button type="button" className="vender-payment-cancel" onClick={onCancelar}>Cancelar</button>
      </div>
      <div className="form-callout payment-digital-callout">
        <strong>Confirmá el pago en tu billetera</strong>
        <span>La app no puede saber si una transferencia se acreditó sola. Mirá el comprobante antes de entregar la mercadería.</span>
      </div>
      <label className="form-field">
        <span className="form-field-label">Referencia o últimos dígitos <em>opcional</em></span>
        <input aria-label="Referencia del pago" className="form-input" placeholder="Ej. 8472 o MP-1234" value={referencia} onChange={(evento) => setReferencia(evento.target.value)} autoFocus />
        <span className="form-field-help">Te ayuda a conciliar el cobro después. No guardamos datos bancarios.</span>
      </label>
      <label className="payment-confirm-check">
        <input type="checkbox" checked={confirmado} onChange={(evento) => setConfirmado(evento.target.checked)} />
        <span><strong>Ya vi el pago aprobado</strong><small>Confirmo que el importe es {formatearPesos(total)}.</small></span>
      </label>
      <button type="submit" className="digital-confirm-button" disabled={!confirmado}>Registrar venta confirmada</button>
      <Boton type="button" variante="secundario" className="w-full !py-3 !text-[13px]" onClick={onVolver}>Volver a medios de pago</Boton>
    </form>
  )
}

function Fiado({
  total,
  onCobrar,
  onVolver,
  onCancelar,
}: {
  total: number
  onCobrar: (clienteId: UUID, vence: number | null) => void
  onVolver: () => void
  onCancelar: () => void
}) {
  const clientes = useLiveQuery(() => repos.clientes.todos(), [], [])
  const [busqueda, setBusqueda] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [vence, setVence] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const hayClientes = (clientes ?? []).length > 0
  const mostrarNuevo = nuevo || !hayClientes
  const visibles = (clientes ?? []).filter((cliente) => {
    const aguja = normalizar(busqueda.trim())
    return aguja === '' || normalizar(`${cliente.nombre} ${cliente.telefono ?? ''}`).includes(aguja)
  })

  function fechaVencimiento(): number | null {
    if (!vence) return null
    const fecha = new Date(`${vence}T23:59:59`)
    return Number.isNaN(fecha.getTime()) ? null : fecha.getTime()
  }

  async function crearCliente(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (nombre.trim() === '') {
      setAviso('Escribí el nombre del cliente.')
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      const cliente = await repos.clientes.guardar({
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
      })
      onCobrar(cliente.id, fechaVencimiento())
    } catch {
      setAviso('No se pudo guardar el cliente. Probá de nuevo.')
      setGuardando(false)
    }
  }

  return (
    <div className="vender-payment-flow form-shell px-5 pt-2">
      <div className="vender-payment-heading">
        <div>
          <span>Venta a cuenta</span><strong>Anotar fiado · {formatearPesos(total)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="vender-payment-cancel" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>

      <div className="form-callout payment-credit-callout">
        <strong>No se cobra ahora</strong>
        <span>La venta queda registrada en la cuenta del cliente.</span>
      </div>

      <section className="form-section payment-due-section">
        <div className="form-section-heading">
          <span className="form-step">1</span>
          <div><h3>Fecha de vencimiento</h3><p>Opcional: te ayuda a detectar cuentas atrasadas.</p></div>
        </div>
        <label className="form-field">
          <span className="form-field-label">Vencimiento <em>opcional</em></span>
          <input aria-label="Vencimiento del fiado" type="date" className="form-input" value={vence} onChange={(evento) => setVence(evento.target.value)} />
        </label>
      </section>

      {!mostrarNuevo && (
        <section className="form-section payment-client-section">
          <div className="form-section-heading">
            <span className="form-step">2</span>
            <div><h3>Elegí el cliente</h3><p>Buscalo por nombre o teléfono.</p></div>
          </div>
          <label className="form-field">
            <span className="form-field-label">Buscar cliente</span>
            <input
              aria-label="Buscar cliente"
              placeholder="Ej. Marta o 261…"
              className="form-input"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              autoFocus
            />
          </label>
          <div className="payment-client-list max-h-44 overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="px-3 py-3 text-[12px]" style={{ color: 'var(--tenue)' }}>
                No encontramos ese cliente.
              </p>
            ) : (
              visibles.map((cliente) => (
                <button
                  key={cliente.id}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left active:opacity-70"
                  style={{ borderBottom: '1px solid var(--linea)' }}
                  onClick={() => onCobrar(cliente.id, fechaVencimiento())}
                  aria-label={`Anotar fiado a ${cliente.nombre}`}
                >
                  <span className="text-[13px] font-medium">{cliente.nombre}</span>
                  {cliente.telefono && (
                    <span className="text-[11px]" style={{ color: 'var(--tenue)' }}>{cliente.telefono}</span>
                  )}
                </button>
              ))
            )}
          </div>
          <Boton variante="secundario" className="button-with-icon mt-2 w-full !py-3 !text-[13px]" onClick={() => setNuevo(true)}>
            <IconoNuevoCliente /> Nuevo cliente
          </Boton>
        </section>
      )}

      {mostrarNuevo && (
        <form className="form-section payment-client-section" onSubmit={crearCliente}>
          <div className="form-section-heading">
            <span className="form-step">2</span>
            <div><h3>Nuevo cliente</h3><p>Guardalo ahora y la próxima vez lo elegís en un toque.</p></div>
          </div>
          <label className="form-field">
            <span className="form-field-label">Nombre del cliente <em>obligatorio</em></span>
            <input
              aria-label="Nombre del cliente"
              autoFocus
              placeholder="Ej. Marta González"
              className="form-input"
              value={nombre}
              onChange={(evento) => { setNombre(evento.target.value); setAviso(null) }}
            />
          </label>
          <label className="form-field">
            <span className="form-field-label">Teléfono para WhatsApp <em>opcional</em></span>
            <input
              aria-label="Teléfono del cliente"
              inputMode="tel"
              placeholder="Ej. 261 555 1234"
              className="form-input"
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
            />
          </label>
          <Boton variante="principal" type="submit" className="w-full !py-3 !text-[13px]" disabled={guardando}>
            {guardando ? 'Guardando cliente…' : 'Anotar fiado'}
          </Boton>
          {hayClientes && (
            <Boton type="button" variante="secundario" className="w-full !py-3 !text-[13px]" onClick={() => setNuevo(false)}>
              Elegir cliente existente
            </Boton>
          )}
        </form>
      )}

      <Boton type="button" variante="secundario" className="w-full !py-3 !text-[13px]" onClick={onVolver}>
        Volver a medios de pago
      </Boton>

      {aviso && <p className="mt-2 text-[12px]" style={{ color: 'var(--ambar)' }}>{aviso}</p>}
    </div>
  )
}

export function Cobro({
  total,
  onCobrar,
  onCancelar,
}: {
  total: number
  onCobrar: (medio: MedioPago, clienteId?: UUID, vence?: number | null, referenciaPago?: string) => void
  onCancelar: () => void
}) {
  const [pantalla, setPantalla] = useState<'medios' | 'efectivo' | 'fiado' | 'transferencia' | 'qr'>('medios')

  if (pantalla === 'efectivo') {
    return <Efectivo total={total} onCobrar={() => onCobrar('efectivo')} onVolver={() => setPantalla('medios')} onCancelar={onCancelar} />
  }
  if (pantalla === 'fiado') {
    return <Fiado total={total} onCobrar={(clienteId, vence) => onCobrar('fiado', clienteId, vence)} onVolver={() => setPantalla('medios')} onCancelar={onCancelar} />
  }
  if (pantalla === 'transferencia' || pantalla === 'qr') {
    return <CobroDigital medio={pantalla} total={total} onCobrar={(referencia) => onCobrar(pantalla, undefined, undefined, referencia)} onVolver={() => setPantalla('medios')} onCancelar={onCancelar} />
  }

  return (
    <div className="vender-payment payment-method-grid grid grid-cols-2 gap-2 px-5 pt-2">
      <div className="vender-payment-heading col-span-2">
        <div><span>Forma de cobro</span><strong>{formatearPesos(total)}</strong></div>
        <button type="button" className="vender-payment-cancel" onClick={onCancelar}>Cancelar</button>
      </div>
      <Boton
        variante="secundario"
        className="payment-method-card !py-3 !text-[12px]"
        onClick={() => setPantalla('efectivo')}
      >
        <IconoEfectivo /><span>Efectivo</span><small>Calculá vuelto</small>
      </Boton>
      {MEDIOS.map(({ medio, texto }) => (
        <Boton
          key={medio}
          variante="secundario"
          className="payment-method-card !py-3 !text-[12px]"
          onClick={() => setPantalla(medio)}
        >
          {medio === 'transferencia' ? <IconoTransferencia /> : <IconoQR />}<span>{texto}</span><small>Confirmar pago</small>
        </Boton>
      ))}
      <Boton variante="fiado" aria-label="Fiado" className="payment-method-card !py-3 !text-[12px]" onClick={() => setPantalla('fiado')}>
        <span className="payment-method-card-mark">$</span><span>Fiado</span><small>Anotar cuenta</small>
      </Boton>
    </div>
  )
}
