'use client'

import './fiados.css'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { deudaPorCliente, saldoFiado } from '@/dominio/fiado'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { estadoVencimiento, etiquetaVencimiento, porcentajeLimite, riesgoFiado, type EstadoVencimiento } from '@/dominio/inteligencia'
import { normalizarTexto } from '@/dominio/validaciones'
import type { Cliente, UUID } from '@/dominio/tipos'
import { mensajeCobro, mensajePagoFiado, enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Etiqueta, type TonoEtiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoEditar, IconoWhatsApp } from '@/ui/sistema/iconos'
import { usePantallaAncha } from './usoPantallaAncha'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { TEXTOS, noSePudo } from '@/ui/sistema/textos'

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join('')
}

function fechaLarga(epoch: number): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(epoch))
}

function textoAntiguedad(dias: number): string {
  if (dias === 0) return 'Anotado hoy'
  return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

const ETIQUETA_ESTADO: Record<EstadoVencimiento, { texto: string; tono: TonoEtiqueta }> = {
  vencido: { texto: 'Vencido', tono: 'coral' },
  'vence-pronto': { texto: 'Vence pronto', tono: 'ambar' },
  'al-dia': { texto: 'Al día', tono: 'gris' },
  'sin-vencimiento': { texto: 'Sin vencimiento', tono: 'gris' },
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
    const limiteCentavos = pesosACentavos(pesosDeTexto(limite))
    setGuardando(true)
    setAviso(null)
    try {
      if (cliente) {
        await repos.clientes.actualizar(cliente.id, { nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: limiteCentavos > 0 ? limiteCentavos : undefined })
      } else {
        await repos.clientes.guardar({ nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: limiteCentavos > 0 ? limiteCentavos : undefined })
      }
      onSaved()
    } catch {
      setAviso(noSePudo('guardar', 'el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta onCerrar={onCancel} titulo={cliente ? `Editar ${cliente.nombre}` : 'Nuevo cliente'} ancho="angosto">
      <form className="f-fiados-form" onSubmit={guardar}>
        <p className="f-hoja-ayuda">{cliente ? 'Actualizá los datos que usás para seguir su cuenta.' : 'Guardá sus datos una sola vez para anotar fiados más rápido.'}</p>
        <label className="f-campo">
          <span>Nombre <em>obligatorio</em></span>
          <input
            aria-label="Nombre del cliente"
            autoFocus
            placeholder="Ej. Marta González"
            className="f-entrada"
            value={nombre}
            onChange={(evento) => { setNombre(evento.target.value); setAviso(null) }}
          />
        </label>
        <label className="f-campo">
          <span>Límite de fiado <em>opcional</em></span>
          <span className="f-fiados-pesos">
            <span aria-hidden="true">$</span>
            <input aria-label="Límite de fiado" inputMode="decimal" placeholder="Ej. 30.000" className="f-entrada tabular" value={limite} onChange={(evento) => setLimite(evento.target.value)} />
          </span>
          <small className="f-dato">Te avisamos cuando la deuda se acerque a este monto.</small>
        </label>
        <label className="f-campo">
          <span>Teléfono para WhatsApp <em>opcional</em></span>
          <input
            aria-label="Teléfono del cliente"
            inputMode="tel"
            placeholder="Ej. 261 555 1234"
            className="f-entrada"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
          <small className="f-dato">Lo usamos para enviar recordatorios o comprobantes por WhatsApp.</small>
        </label>
        {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
        <Boton variante="principal" type="submit" ancho disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </Boton>
      </form>
    </Hoja>
  )
}

function Movimientos({ clienteId }: { clienteId: UUID }) {
  const movimientos = useLiveQuery(async () => {
    const [ventas, fiados, pagos] = await Promise.all([
      repos.ventas.todas(),
      db.fiados.where('clienteId').equals(clienteId).toArray(),
      repos.fiados.pagos(),
    ])
    return [
      ...ventas
        .filter((venta) => venta.clienteId === clienteId)
        .map((venta) => ({ id: `venta-${venta.id}`, fecha: venta.fecha, tipo: 'Compra', monto: venta.total, signo: 1 })),
      ...pagos
        .filter((pago) => fiados.some((fiado) => fiado.id === pago.fiadoId))
        .map((pago) => ({ id: `pago-${pago.id}`, fecha: pago.fecha, tipo: 'Pago', monto: pago.monto, signo: -1 })),
    ].sort((a, b) => b.fecha - a.fecha)
  }, [clienteId])

  return (
    <section className="f-fiados-movimientos" aria-label="Movimientos">
      <h3 className="f-seccion">Movimientos</h3>
      {!movimientos ? <EstadoCarga compacto filas={2} texto="Cargando movimientos…" /> : movimientos.length === 0 ? (
        <EstadoVacio compacto titulo="Todavía no hay movimientos" texto="Cada deuda y cada pago de este cliente queda anotado acá." />
      ) : (
        <ul className="f-fiados-movimientos-lista">
          {movimientos.map((movimiento) => (
            <li key={movimiento.id} className="f-renglon">
              <span className="f-renglon-cuerpo">
                <span className="f-renglon-titulo">{movimiento.tipo}</span>
                <span className="f-renglon-detalle">{fechaLarga(movimiento.fecha)}</span>
              </span>
              <span className="f-renglon-fin" data-signo={movimiento.signo > 0 ? 'debe' : 'pago'}>
                {movimiento.signo > 0 ? '+' : '−'}{formatearPesos(movimiento.monto)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Deuda = {
  clienteId: UUID
  saldo: number
  diasDelMasViejo: number
  cliente: Cliente
  vence: number | null
  estado: EstadoVencimiento
  riesgo: ReturnType<typeof riesgoFiado>
  porcentajeLimite: number | null
}

function DetalleCuenta({
  deuda,
  onCobrarTodo,
  onRegistrarPago,
  onEditar,
}: {
  deuda: Deuda
  onCobrarTodo: () => void
  onRegistrarPago: () => void
  onEditar: () => void
}) {
  const { cliente } = deuda
  const estado = ETIQUETA_ESTADO[deuda.estado]
  const uso = deuda.porcentajeLimite
  return (
    <div className="f-fiados-cuenta">
      <div className="f-fiados-cuenta-cabeza">
        <span className="f-fiados-avatar" data-grande="true" data-vencido={deuda.estado === 'vencido'} aria-hidden="true">{iniciales(cliente.nombre)}</span>
        <span className="f-fiados-cuenta-nombre">
          <h2 className="f-fiados-cuenta-titulo">{cliente.nombre}</h2>
          <span className="f-dato">
            {cliente.telefono ?? 'Sin teléfono'}
            {cliente.limiteFiado ? ` · límite ${formatearPesos(cliente.limiteFiado)}` : ''}
          </span>
        </span>
        <span className="f-fiados-etiquetas">
          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          {deuda.riesgo === 'alto' && <Etiqueta tono="coral">Riesgo alto</Etiqueta>}
          {deuda.riesgo === 'medio' && <Etiqueta tono="ambar">Riesgo medio</Etiqueta>}
        </span>
      </div>

      <div className="f-fiados-datos">
        <div className="f-fiados-dato">
          <span className="f-dato">Debe</span>
          <b className="f-fiados-dato-grande" data-tono="coral">{formatearPesos(deuda.saldo)}</b>
        </div>
        <div className="f-fiados-dato">
          <span className="f-dato">Le fiás desde</span>
          <b className="f-fiados-dato-medio">{textoAntiguedad(deuda.diasDelMasViejo)}</b>
          <span className="f-dato">{etiquetaVencimiento(deuda.vence)}</span>
        </div>
        <div className="f-fiados-dato">
          <span className="f-dato">Usó de su límite</span>
          {uso === null ? (
            <b className="f-fiados-dato-medio">Sin límite</b>
          ) : (
            <>
              <b className="f-fiados-dato-medio">{uso}%</b>
              <span className="f-fiados-barra" role="img" aria-label={`Usó ${uso}% de su límite`}>
                <span style={{ width: `${Math.min(100, uso)}%` }} data-lleno={uso >= 100} />
              </span>
            </>
          )}
        </div>
      </div>

      <div className="f-fiados-acciones">
        <Boton variante="principal" tamano="grande" onClick={onCobrarTodo}>
          Cobrar todo <span className="f-fiados-monto">{formatearPesos(deuda.saldo)}</span>
        </Boton>
        <Boton variante="secundario" tamano="grande" onClick={onRegistrarPago}>
          Registrar pago
        </Boton>
        {cliente.telefono && (
          <a
            className={clasesBoton('secundario')}
            data-tamano="grande"
            target="_blank"
            rel="noreferrer"
            href={enlaceWhatsApp(cliente.telefono, mensajeCobro(cliente, deuda.saldo, deuda.diasDelMasViejo))}
          >
            <IconoWhatsApp /> Mandar mensaje
          </a>
        )}
        <Boton variante="secundario" tamano="grande" onClick={onEditar}>
          <IconoEditar /> Editar cliente
        </Boton>
      </div>

      <Movimientos clienteId={deuda.clienteId} />
    </div>
  )
}

export function PantallaFiados() {
  const ancha = usePantallaAncha()
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<UUID | null>(null)
  const [clientePagando, setClientePagando] = useState<UUID | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [avisoPago, setAvisoPago] = useState<string | null>(null)
  const [formularioCliente, setFormularioCliente] = useState<'nuevo' | Cliente | null>(null)
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [ultimoPago, setUltimoPago] = useState<{ clienteId: UUID; monto: number } | null>(null)
  const datos = useLiveQuery(async () => {
    const [fiados, pagos, clientes] = await Promise.all([
      db.fiados.toArray(),
      repos.fiados.pagos(),
      repos.clientes.todos(),
    ])
    const ahora = Date.now()
    const deudas: Deuda[] = []
    for (const deuda of deudaPorCliente(fiados, pagos, ahora)) {
      const cliente = clientes.find((item) => item.id === deuda.clienteId)
      if (!cliente) continue
      const abiertos = fiados.filter((fiado) => fiado.clienteId === deuda.clienteId && saldoFiado(fiado, pagos) > 0)
      const vencimientos = abiertos.map((fiado) => fiado.vence).filter((vence): vence is number => vence !== null)
      const vence = vencimientos.length > 0 ? Math.min(...vencimientos) : null
      deudas.push({
        clienteId: deuda.clienteId,
        saldo: deuda.saldo,
        diasDelMasViejo: deuda.diasDelMasViejo,
        cliente,
        vence,
        estado: estadoVencimiento(vence, ahora),
        riesgo: riesgoFiado(deuda.saldo, cliente.limiteFiado, deuda.diasDelMasViejo),
        porcentajeLimite: porcentajeLimite(deuda.saldo, cliente.limiteFiado),
      })
    }
    return { deudas, clientes }
  }, [], { deudas: [] as Deuda[], clientes: [] as Cliente[] })

  const aguja = normalizarTexto(busqueda)
  const deudas = datos.deudas.filter((deuda) => {
    if (soloVencidos && deuda.estado !== 'vencido') return false
    if (aguja === '') return true
    return normalizarTexto(`${deuda.cliente.nombre} ${deuda.cliente.telefono ?? ''}`).includes(aguja)
  })
  const vencidas = datos.deudas.filter((deuda) => deuda.estado === 'vencido').length
  const totalDeuda = datos.deudas.reduce((total, deuda) => total + deuda.saldo, 0)
  // En la PC siempre hay una cuenta a la vista (la elegida o la primera);
  // en el celu sólo cuando se toca un cliente.
  const abierta = datos.deudas.find((deuda) => deuda.clienteId === seleccionado) ?? (ancha ? deudas[0] : undefined)
  const pagando = clientePagando ? datos.deudas.find((deuda) => deuda.clienteId === clientePagando) : undefined

  async function cobrarTodo(clienteId: UUID, saldo: number) {
    if (saldo <= 0) return
    const pagado = await repos.fiados.pagarCliente(clienteId, saldo)
    setUltimoPago({ clienteId, monto: pagado })
    setSeleccionado(null)
  }

  async function registrarPago(clienteId: UUID, saldo: number) {
    const monto = pesosACentavos(pesosDeTexto(montoPago))
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
      setAvisoPago(noSePudo('registrar', 'el pago'))
    } finally {
      setGuardandoPago(false)
    }
  }

  const detalle = abierta && (
    <DetalleCuenta
      deuda={abierta}
      onCobrarTodo={() => void cobrarTodo(abierta.clienteId, abierta.saldo)}
      onRegistrarPago={() => { setClientePagando(abierta.clienteId); setMontoPago(''); setAvisoPago(null) }}
      onEditar={() => setFormularioCliente(abierta.cliente)}
    />
  )

  const clientePago = ultimoPago ? datos.clientes.find((item) => item.id === ultimoPago.clienteId) : undefined
  const deudaActualPago = ultimoPago ? datos.deudas.find((item) => item.clienteId === ultimoPago.clienteId)?.saldo ?? 0 : 0

  return (
    <div className="page-fiados f-fiados">
      <div className="f-fiados-lista-col">
        <header className="f-fiados-cabeza">
          <h1 className="f-titulo">Fiados</h1>
          <Boton variante="secundario" onClick={() => setFormularioCliente('nuevo')}>
            + Cliente
          </Boton>
        </header>

        <div className="f-fiados-total">
          <span className="f-fiados-total-texto">
            <span className="f-fiados-total-rotulo">Te deben</span>
            <span className="f-dato">
              {datos.deudas.length} {datos.deudas.length === 1 ? 'cliente' : 'clientes'} · {vencidas} {vencidas === 1 ? 'vencido' : 'vencidos'}
            </span>
          </span>
          <b className="f-plata f-fiados-total-monto">{formatearPesos(totalDeuda)}</b>
        </div>

        {datos.clientes.length > 0 && (
          <CampoBusqueda etiqueta="Buscar cliente en fiados" placeholder="Buscar cliente" valor={busqueda} onCambiar={setBusqueda} />
        )}

        {datos.deudas.length > 0 && (
          <Chips etiqueta="Filtrar fiados">
            <Chip activo={!soloVencidos} onClick={() => setSoloVencidos(false)}>Todos</Chip>
            <Chip activo={soloVencidos} onClick={() => setSoloVencidos(true)}>Vencidos ({vencidas})</Chip>
          </Chips>
        )}

        {ultimoPago && clientePago && (
          <div className="f-fiados-pago" role="status">
            <span>Pago de {clientePago.nombre} guardado: <strong>{formatearPesos(ultimoPago.monto)}</strong></span>
            {clientePago.telefono && (
              <a className="f-fiados-enlace" target="_blank" rel="noreferrer" href={enlaceWhatsApp(clientePago.telefono, mensajePagoFiado(clientePago, ultimoPago.monto, deudaActualPago))}>
                Enviar comprobante por WhatsApp
              </a>
            )}
          </div>
        )}

        {deudas.length === 0 ? (
          datos.deudas.length === 0 ? (
            <EstadoVacio
              titulo="No te debe nadie"
              texto="Cuando anotes una venta fiada, acá vas a ver quién debe, cuánto y desde cuándo."
              accion={{ etiqueta: TEXTOS.agregarCliente, alTocar: () => setFormularioCliente('nuevo'), variante: 'principal' }}
            />
          ) : (
            <EstadoVacio titulo="No encontramos clientes" texto="Probá con otro nombre o teléfono." />
          )
        ) : (
          <Tarjeta como="ul" relleno="ninguno" className="f-fiados-lista" aria-label="Clientes que deben">
            {deudas.map((deuda) => {
              const vencido = deuda.estado === 'vencido'
              return (
                <li key={deuda.clienteId}>
                  <button
                    type="button"
                    className="f-fiados-fila"
                    aria-current={abierta?.clienteId === deuda.clienteId ? 'true' : undefined}
                    onClick={() => setSeleccionado(deuda.clienteId)}
                  >
                    <span className="f-fiados-avatar" data-vencido={vencido} aria-hidden="true">{iniciales(deuda.cliente.nombre)}</span>
                    <span className="f-renglon-cuerpo">
                      <span className="f-renglon-titulo">{deuda.cliente.nombre}</span>
                      <span className="f-renglon-detalle" data-tono={vencido ? 'coral' : undefined}>{etiquetaVencimiento(deuda.vence)}</span>
                    </span>
                    <span className="f-renglon-fin">{formatearPesos(deuda.saldo)}</span>
                  </button>
                </li>
              )
            })}
          </Tarjeta>
        )}

        {deudas.length > 0 && <p className="f-texto f-fiados-pista">Tocá un cliente para cobrarle, ver su cuenta o recordarle por WhatsApp.</p>}
      </div>

      {abierta && ancha && (
        <Tarjeta como="section" relleno="grande" className="f-fiados-detalle" aria-label={`Cuenta de ${abierta.cliente.nombre}`}>
          {detalle}
        </Tarjeta>
      )}
      {abierta && !ancha && (
        <Hoja abierta onCerrar={() => setSeleccionado(null)} titulo={`Cuenta de ${abierta.cliente.nombre}`}>
          {detalle}
        </Hoja>
      )}

      {formularioCliente && (
        <ClienteForm
          cliente={formularioCliente === 'nuevo' ? undefined : formularioCliente}
          onCancel={() => setFormularioCliente(null)}
          onSaved={() => setFormularioCliente(null)}
        />
      )}

      {pagando && (
        <Hoja abierta onCerrar={() => setClientePagando(null)} titulo="Registrar un pago" ancho="angosto">
          <form className="f-fiados-form" onSubmit={(evento) => { evento.preventDefault(); void registrarPago(pagando.clienteId, pagando.saldo) }}>
            <p className="f-hoja-ayuda">El importe se descuenta de la deuda más antigua de <b>{pagando.cliente.nombre}</b>.</p>
            <div className="f-fiados-deuda-actual">
              <span>Deuda actual</span>
              <b className="f-plata">{formatearPesos(pagando.saldo)}</b>
            </div>
            <label className="f-campo">
              <span>¿Cuánto pagó? <em>importe recibido</em></span>
              <span className="f-fiados-pesos">
                <span aria-hidden="true">$</span>
                <input
                  aria-label={`Pago de ${pagando.cliente.nombre}`}
                  inputMode="decimal"
                  autoFocus
                  placeholder="Ej. 2.000"
                  className="f-entrada tabular"
                  value={montoPago}
                  onChange={(evento) => { setMontoPago(evento.target.value); setAvisoPago(null) }}
                />
              </span>
              <small className="f-dato">No puede superar la deuda actual.</small>
            </label>
            {avisoPago && <p className="f-aviso" role="alert">{avisoPago}</p>}
            <Boton variante="principal" type="submit" ancho disabled={guardandoPago}>{guardandoPago ? 'Guardando…' : 'Confirmar pago'}</Boton>
          </form>
        </Hoja>
      )}
    </div>
  )
}
