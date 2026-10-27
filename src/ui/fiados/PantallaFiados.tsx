'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { deudaPorCliente, saldoFiado } from '@/dominio/fiado'
import { pesosACentavos } from '@/dominio/dinero'
import { estadoVencimiento, etiquetaVencimiento, porcentajeLimite, riesgoFiado, type RiesgoFiado } from '@/dominio/inteligencia'
import { normalizarTexto } from '@/dominio/validaciones'
import type { Cliente, UUID } from '@/dominio/tipos'
import { mensajeCobro, mensajePagoFiado, enlaceWhatsApp } from '@/dominio/mensajes'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { IconoFiados, IconoNuevoCliente } from '@/ui/sistema/iconos'

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join('')
}

function etiquetaRiesgo(riesgo: RiesgoFiado): string {
  if (riesgo === 'alto') return 'Riesgo alto'
  if (riesgo === 'medio') return 'Riesgo medio'
  if (riesgo === 'bajo') return 'Riesgo bajo'
  return 'Sin deuda'
}

function ClienteForm({
  cliente,
  onCancel,
  onSaved,
}: {
  cliente?: Cliente
  onCancel: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [limite, setLimite] = useState(cliente?.limiteFiado ? String(cliente.limiteFiado / 100) : '')
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (nombre.trim().length < 2) {
      setAviso('Escribí el nombre del cliente.')
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      if (cliente) {
        await repos.clientes.actualizar(cliente.id, { nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: Number(limite) > 0 ? pesosACentavos(Number(limite)) : undefined })
      } else {
        await repos.clientes.guardar({ nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: Number(limite) > 0 ? pesosACentavos(Number(limite)) : undefined })
      }
      onSaved()
    } catch {
      setAviso('No se pudo guardar el cliente. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form-shell form-card fiado-client-form mt-3" onSubmit={guardar}>
      <div className="form-section-heading">
        <span className="form-intro-icon" aria-hidden="true"><IconoNuevoCliente /></span>
        <div><h2>{cliente ? `Editar ${cliente.nombre}` : 'Nuevo cliente'}</h2><p>{cliente ? 'Actualizá los datos que usás para seguir su cuenta.' : 'Guardá sus datos una sola vez para anotar fiados más rápido.'}</p></div>
      </div>
      <label className="form-field">
        <span className="form-field-label">Nombre <em>obligatorio</em></span>
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
        <span className="form-field-label">Límite de fiado <em>opcional</em></span>
        <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input aria-label="Límite de fiado" inputMode="decimal" placeholder="Ej. 30.000" className="form-input tabular" value={limite} onChange={(evento) => setLimite(evento.target.value)} /></div>
        <span className="form-field-help">Te avisamos cuando la deuda se acerque a este monto.</span>
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
        <span className="form-field-help">Lo usamos para enviar recordatorios o comprobantes por WhatsApp.</span>
      </label>
      <div className="form-actions">
        <Boton variante="principal" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </Boton>
        <Boton variante="secundario" type="button" onClick={onCancel}>
          Cancelar
        </Boton>
      </div>
      {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
    </form>
  )
}

function HistorialCliente({ clienteId, nombre, onCerrar }: { clienteId: UUID; nombre: string; onCerrar: () => void }) {
  const datos = useLiveQuery(async () => {
    const [ventas, fiados, pagos] = await Promise.all([
      repos.ventas.todas(),
      db.fiados.where('clienteId').equals(clienteId).toArray(),
      repos.fiados.pagos(),
    ])
    const movimientos = [
      ...ventas
        .filter((venta) => venta.clienteId === clienteId)
        .map((venta) => ({ id: `venta-${venta.id}`, fecha: venta.fecha, tipo: 'Compra', monto: venta.total, signo: 1 })),
      ...pagos
        .filter((pago) => fiados.some((fiado) => fiado.id === pago.fiadoId))
        .map((pago) => ({ id: `pago-${pago.id}`, fecha: pago.fecha, tipo: 'Pago', monto: pago.monto, signo: -1 })),
    ].sort((a, b) => b.fecha - a.fecha)
    const saldo = fiados.reduce((total, fiado) => total + saldoFiado(fiado, pagos), 0)
    return { movimientos, saldo }
  }, [clienteId])

  if (!datos) return null
  return (
    <div className="mt-3 rounded-2xl px-3.5 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Historial de {nombre}</h2>
        <button type="button" className="text-[12px]" style={{ color: 'var(--tenue)' }} onClick={onCerrar}>Cerrar</button>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>Saldo actual</span>
        <Importe centavos={datos.saldo} tamaño="chico" style={{ color: datos.saldo > 0 ? 'var(--ambar)' : 'var(--verde)' }} />
      </div>
      {datos.movimientos.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--tenue)' }}>Todavía no hay movimientos.</p>
      ) : (
        <ul className="mt-2">
          {datos.movimientos.map((movimiento) => (
            <li key={movimiento.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--linea)' }}>
              <div>
                <div className="text-[12px] font-medium">{movimiento.tipo}</div>
                <div className="text-[12px]" style={{ color: 'var(--tenue)' }}>{new Date(movimiento.fecha).toLocaleDateString('es-AR')}</div>
              </div>
              <Importe centavos={movimiento.monto} tamaño="chico" style={{ color: movimiento.signo > 0 ? 'var(--ambar)' : 'var(--verde)' }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PantallaFiados() {
  const [busqueda, setBusqueda] = useState('')
  const [clientePagando, setClientePagando] = useState<UUID | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [avisoPago, setAvisoPago] = useState<string | null>(null)
  const [formularioCliente, setFormularioCliente] = useState<'nuevo' | Cliente | null>(null)
  const [historialCliente, setHistorialCliente] = useState<UUID | null>(null)
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [ultimoPago, setUltimoPago] = useState<{ clienteId: UUID; monto: number } | null>(null)
  const datos = useLiveQuery(async () => {
    const [fiados, pagos, clientes] = await Promise.all([
      db.fiados.toArray(),
      repos.fiados.pagos(),
      repos.clientes.todos(),
    ])
    const ahora = Date.now()
    const deudas = deudaPorCliente(fiados, pagos, ahora)
      .map((deuda) => ({
        ...deuda,
        cliente: clientes.find((cliente) => cliente.id === deuda.clienteId),
        fiadosDelCliente: fiados.filter((fiado) => fiado.clienteId === deuda.clienteId),
      }))
      .filter((deuda) => deuda.cliente !== undefined)
      .map((deuda) => {
        const abiertos = deuda.fiadosDelCliente.filter((fiado) => saldoFiado(fiado, pagos) > 0)
        const vencimientos = abiertos.map((fiado) => fiado.vence).filter((vence): vence is number => vence !== null)
        const vence = vencimientos.length > 0 ? Math.min(...vencimientos) : null
        return {
          ...deuda,
          vence,
          estado: estadoVencimiento(vence, ahora),
          riesgo: riesgoFiado(deuda.saldo, deuda.cliente!.limiteFiado, deuda.diasDelMasViejo),
          porcentajeLimite: porcentajeLimite(deuda.saldo, deuda.cliente!.limiteFiado),
        }
      })
    return { deudas, clientes }
  }, [], { deudas: [], clientes: [] })

  const aguja = normalizarTexto(busqueda)
  const deudas = datos.deudas.filter((deuda) => {
    if (soloVencidos && deuda.estado !== 'vencido') return false
    if (aguja === '') return true
    return normalizarTexto(`${deuda.cliente!.nombre} ${deuda.cliente!.telefono ?? ''}`).includes(aguja)
  })
  const vencidas = datos.deudas.filter((deuda) => deuda.estado === 'vencido').length
  const totalDeuda = datos.deudas.reduce((total, deuda) => total + deuda.saldo, 0)
  const clienteHistorial = historialCliente ? datos.clientes.find((cliente) => cliente.id === historialCliente) : undefined

  async function cobrarTodo(clienteId: UUID, saldo: number) {
    if (saldo <= 0) return
    const pagado = await repos.fiados.pagarCliente(clienteId, saldo)
    setUltimoPago({ clienteId, monto: pagado })
  }

  async function registrarPago(clienteId: UUID, saldo: number) {
    const monto = pesosACentavos(Number(montoPago))
    if (!Number.isFinite(monto) || monto <= 0) {
      setAvisoPago('Escribí un monto válido.')
      return
    }
    if (monto > saldo) {
      setAvisoPago('El pago no puede superar lo que debe.')
      return
    }
    setGuardandoPago(true)
    setAvisoPago(null)
    try {
      await repos.fiados.pagarCliente(clienteId, monto)
      setUltimoPago({ clienteId, monto })
      setMontoPago('')
      setClientePagando(null)
    } catch {
      setAvisoPago('No se pudo registrar el pago. Probá de nuevo.')
    } finally {
      setGuardandoPago(false)
    }
  }

  return (
    <div className="page-fiados px-5 pt-6">
      <div className="page-module-head fiados-head">
        <div>
          <span className="page-kicker">Relación con clientes</span>
          <h1 className="page-title">Fiados</h1>
          <div className="mt-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Te deben</div>
          <Importe centavos={totalDeuda} tamaño="grande" style={{ color: 'var(--ambar)' }} />
        </div>
        <Boton variante="secundario" className="button-with-icon !py-2.5 !text-[12px]" onClick={() => setFormularioCliente('nuevo')}>
          <IconoNuevoCliente /> Nuevo cliente
        </Boton>
      </div>

      <div className="fiados-summary-grid">
        <div className="fiados-summary-card"><span>Clientes activos</span><strong>{datos.deudas.length}</strong></div>
        <div className="fiados-summary-card"><span>Vencidos</span><strong style={{ color: vencidas > 0 ? 'var(--ambar)' : 'var(--verde)' }}>{vencidas}</strong></div>
        <div className="fiados-summary-card"><span>Promedio por cliente</span><strong>{datos.deudas.length > 0 ? <Importe centavos={Math.round(totalDeuda / datos.deudas.length)} tamaño="chico" /> : '$0'}</strong></div>
      </div>

      {formularioCliente && (
        <ClienteForm
          cliente={formularioCliente === 'nuevo' ? undefined : formularioCliente}
          onCancel={() => setFormularioCliente(null)}
          onSaved={() => setFormularioCliente(null)}
        />
      )}

      {datos.clientes.length > 0 && (
        <input
          aria-label="Buscar cliente en fiados"
          placeholder="Buscar cliente…"
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-[14px]"
          style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }}
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
      )}

      <div className="fiados-toolbar mt-2 flex gap-2">
        <Boton variante={soloVencidos ? 'fiado' : 'secundario'} className="flex-1 !py-2.5 !text-[12px]" aria-pressed={soloVencidos} onClick={() => setSoloVencidos((actual) => !actual)}>
          {soloVencidos ? 'Mostrando vencidos' : `Vencidos (${vencidas})`}
        </Boton>
        <span className="flex items-center rounded-2xl px-2.5 text-[12px]" style={{ background: 'var(--chip-fondo)', color: 'var(--tenue)' }}>Riesgo y límite activos</span>
      </div>

      {ultimoPago && (() => {
        const cliente = datos.clientes.find((item) => item.id === ultimoPago.clienteId)
        const deudaActual = datos.deudas.find((item) => item.clienteId === ultimoPago.clienteId)?.saldo ?? 0
        return cliente ? (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-[12px]" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
            <div>Pago de {cliente.nombre} guardado: <strong>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(ultimoPago.monto / 100)}</strong></div>
            {cliente.telefono && <a className="mt-1 inline-block font-semibold" style={{ color: 'var(--verde)' }} target="_blank" rel="noreferrer" href={enlaceWhatsApp(cliente.telefono, mensajePagoFiado(cliente, ultimoPago.monto, deudaActual))}>Enviar comprobante por WhatsApp</a>}
          </div>
        ) : null
      })()}

      {clienteHistorial && historialCliente && (
        <HistorialCliente clienteId={historialCliente} nombre={clienteHistorial.nombre} onCerrar={() => setHistorialCliente(null)} />
      )}

      {deudas.length === 0 ? (
        datos.deudas.length === 0 ? (
          <section className="fiados-empty-state" aria-labelledby="fiados-empty-title">
            <span className="fiados-empty-icon" aria-hidden="true"><IconoFiados /></span>
            <span className="fiados-empty-kicker">Todo al día</span>
            <h2 id="fiados-empty-title">No te debe nadie</h2>
            <p>Cuando anotes una venta fiada, acá vas a ver quién debe, cuánto y desde cuándo.</p>
            <Boton variante="principal" className="button-with-icon fiados-empty-action" onClick={() => setFormularioCliente('nuevo')}><IconoNuevoCliente /> Agregar un cliente</Boton>
          </section>
        ) : (
          <p className="px-0 py-12 text-center text-sm" style={{ color: 'var(--tenue)' }}>Ningún cliente coincide con la búsqueda.</p>
        )
      ) : (
        <ul className="fiados-list mt-3">
          {deudas.map((deuda) => (
            <li key={deuda.clienteId} className="fiado-card py-4" style={{ borderBottom: '1px solid var(--linea)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--ambar-fondo)', color: 'var(--ambar)' }}>
                  {iniciales(deuda.cliente!.nombre)}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[15px] font-semibold">{deuda.cliente!.nombre}</div>
                  <div className="mt-0.5 text-[12px]" style={{ color: 'var(--tenue)' }}>
                    {deuda.diasDelMasViejo === 0 ? 'anotado hoy' : `desde hace ${deuda.diasDelMasViejo} ${deuda.diasDelMasViejo === 1 ? 'día' : 'días'}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full px-1.5 py-0.5 text-[12px] font-semibold" style={{ background: deuda.riesgo === 'alto' ? 'var(--ambar-fondo)' : 'var(--hueso-2)', color: deuda.riesgo === 'alto' ? 'var(--ambar)' : 'var(--tenue)' }}>{etiquetaRiesgo(deuda.riesgo)}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[12px]" style={{ background: deuda.estado === 'vencido' ? 'var(--ambar-fondo)' : 'var(--hueso-2)', color: deuda.estado === 'vencido' ? 'var(--ambar)' : 'var(--tenue)' }}>{etiquetaVencimiento(deuda.vence)}</span>
                  </div>
                </div>
                <Importe centavos={deuda.saldo} style={{ color: 'var(--ambar)' }} />
              </div>
              {deuda.porcentajeLimite !== null && <div className="mt-2"><div className="flex justify-between text-[12px]" style={{ color: 'var(--tenue)' }}><span>Uso de límite</span><span>{deuda.porcentajeLimite}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--linea)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, deuda.porcentajeLimite)}%`, background: deuda.porcentajeLimite >= 100 ? 'var(--ambar)' : 'var(--verde)' }} /></div></div>}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Boton variante="principal" className="!py-2.5 !text-[12px]" onClick={() => void cobrarTodo(deuda.clienteId, deuda.saldo)}>
                  Cobrar todo
                </Boton>
                <Boton variante="secundario" className="!py-2.5 !text-[12px]" onClick={() => { setClientePagando(deuda.clienteId); setMontoPago(''); setAvisoPago(null) }}>
                  Registrar pago
                </Boton>
                <Boton variante="secundario" className="!py-2.5 !text-[12px]" onClick={() => setHistorialCliente(deuda.clienteId)}>
                  Ver historial
                </Boton>
                {deuda.cliente!.telefono && (
                  <a
                    className="rounded-2xl py-2.5 text-center text-[12px] font-semibold transition-opacity active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--verde)]"
                    style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }}
                    target="_blank"
                    rel="noreferrer"
                    href={enlaceWhatsApp(deuda.cliente!.telefono, mensajeCobro(deuda.cliente!, deuda.saldo, deuda.diasDelMasViejo))}
                  >
                    Mandar mensaje
                  </a>
                )}
                <Boton variante="secundario" className="!py-2.5 !text-[12px]" onClick={() => setFormularioCliente(deuda.cliente!)}>
                  Editar cliente
                </Boton>
              </div>

              {clientePagando === deuda.clienteId && (
                <form className="form-shell form-card fiado-payment-form mt-3" onSubmit={(evento) => { evento.preventDefault(); void registrarPago(deuda.clienteId, deuda.saldo) }}>
                  <div className="form-section-heading">
                    <span className="form-step"><IconoFiados /></span>
                    <div><h3>Registrar un pago</h3><p>El importe se descuenta de la deuda más antigua.</p></div>
                  </div>
                  <div className="form-callout payment-total-callout">
                    <span>Deuda actual</span>
                    <strong><Importe centavos={deuda.saldo} tamaño="normal" style={{ color: 'var(--ambar)' }} /></strong>
                  </div>
                  <label className="form-field">
                    <span className="form-field-label">¿Cuánto pagó? <em>importe recibido</em></span>
                    <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input
                      aria-label={`Pago de ${deuda.cliente!.nombre}`}
                      inputMode="decimal"
                      autoFocus
                      placeholder="Ej. 2.000"
                      className="form-input form-input-large tabular"
                      value={montoPago}
                      onChange={(evento) => { setMontoPago(evento.target.value); setAvisoPago(null) }}
                    /></div>
                    <span className="form-field-help">No puede superar la deuda actual.</span>
                  </label>
                  <div className="form-actions">
                    <Boton variante="principal" type="submit" disabled={guardandoPago}>{guardandoPago ? 'Guardando…' : 'Confirmar pago'}</Boton>
                    <Boton variante="secundario" type="button" onClick={() => setClientePagando(null)}>Cancelar</Boton>
                  </div>
                  {avisoPago && <p className="form-error form-error-banner" role="alert">{avisoPago}</p>}
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
