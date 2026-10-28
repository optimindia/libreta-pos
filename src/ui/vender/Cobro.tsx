'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, MedioPago, UUID } from '@/dominio/tipos'
import { superaLimiteFiado } from '@/dominio/fiado'
import { formatearPesos, pesosACentavos, vuelto } from '@/dominio/dinero'
import { conPuntos, soloDigitos, sugerenciasDePago, teclear, type TeclaCobro } from '@/dominio/cobro'
import { repos } from '@/datos/local/repos'
import { IconoBorrar, IconoCerrar, IconoNuevoCliente } from '@/ui/sistema/iconos'

type Pantalla = 'efectivo' | 'transferencia' | 'qr' | 'fiado'

const SEGMENTOS: { clave: Pantalla; visible: string; nombre: string }[] = [
  { clave: 'efectivo', visible: 'Efectivo', nombre: 'Efectivo' },
  // El nombre accesible es la palabra completa; el texto corto sólo cabe mejor.
  { clave: 'transferencia', visible: 'Transf.', nombre: 'Transferencia' },
  { clave: 'qr', visible: 'QR', nombre: 'QR' },
  { clave: 'fiado', visible: 'Fiado', nombre: 'Fiado' },
]

const TECLAS: TeclaCobro[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'borrar']

/** Cobro en efectivo: cuánto te dan, cuánto es el vuelto y un teclado grande.
 *  Los botones de arriba ("Justo", $14.000…) resuelven el caso más común en
 *  un solo toque. */
function Efectivo({ total, onCobrar }: { total: number; onCobrar: () => void }) {
  const [pagoCon, setPagoCon] = useState('')
  const entregado = pesosACentavos(Number(pagoCon) || 0)
  const resto = vuelto(entregado, total)
  const hayPago = pagoCon !== ''
  const alcanza = hayPago && resto >= 0
  const justo = String(Math.ceil(total / 100))

  return (
    <form
      className="mz-cobro-cuerpo"
      onSubmit={(evento) => { evento.preventDefault(); if (alcanza) onCobrar() }}
    >
      <div className="mz-pares">
        <label className="mz-tablero">
          <span className="mz-tablero-titulo">Te dan</span>
          <span className="mz-tablero-valor">
            <span aria-hidden="true">$</span>
            <input
              aria-label="Con cuánto pagó"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              className="mz-tablero-input tabular"
              value={conPuntos(pagoCon)}
              onChange={(evento) => setPagoCon(soloDigitos(evento.target.value))}
            />
          </span>
        </label>
        <div className="mz-tablero mz-tablero-menta">
          <span className="mz-tablero-titulo">Vuelto</span>
          <strong className="mz-tablero-valor tabular">{alcanza ? formatearPesos(resto) : '—'}</strong>
        </div>
      </div>

      {hayPago && resto < 0 && (
        <p className="mz-aviso" role="status">Le faltan {formatearPesos(-resto)} para cubrir la venta.</p>
      )}

      <div className="mz-billetes">
        <button type="button" className="mz-billete mz-toque" data-activo={pagoCon === justo ? 'true' : 'false'} onClick={() => setPagoCon(justo)}>Justo</button>
        {sugerenciasDePago(total).map((sugerido) => {
          const pesos = String(sugerido / 100)
          return (
            <button key={pesos} type="button" className="mz-billete mz-toque" data-activo={pagoCon === pesos ? 'true' : 'false'} onClick={() => setPagoCon(pesos)}>
              {formatearPesos(sugerido)}
            </button>
          )
        })}
      </div>

      <div className="mz-teclado" role="group" aria-label="Teclado numérico">
        {TECLAS.map((tecla) => (
          <button
            key={tecla}
            type="button"
            className="mz-tecla mz-toque"
            aria-label={tecla === 'borrar' ? 'Borrar' : tecla}
            onClick={() => setPagoCon((actual) => teclear(actual, tecla))}
          >
            {tecla === 'borrar' ? <IconoBorrar /> : tecla}
          </button>
        ))}
      </div>

      <button type="submit" className="mz-cobrar mz-toque" disabled={!alcanza}>
        Cobrar {formatearPesos(total)}
      </button>
    </form>
  )
}

function CobroDigital({
  medio,
  total,
  onCobrar,
}: {
  medio: 'transferencia' | 'qr'
  total: number
  onCobrar: (referencia?: string) => void
}) {
  const [confirmado, setConfirmado] = useState(false)
  const [referencia, setReferencia] = useState('')

  return (
    <form className="mz-cobro-cuerpo" onSubmit={(evento) => { evento.preventDefault(); if (confirmado) onCobrar(referencia) }}>
      <div className="mz-aviso-grande">
        <strong>Mirá tu celu antes de cobrar</strong>
        <span>La app no puede saber si {medio === 'qr' ? 'un QR' : 'una transferencia'} ya se acreditó. Confirmá el comprobante antes de entregar la mercadería.</span>
      </div>
      <label className="mz-campo">
        <span>Referencia o últimos dígitos <em>opcional</em></span>
        <input aria-label="Referencia del pago" className="mz-entrada" placeholder="Ej. 8472 o MP-1234" value={referencia} onChange={(evento) => setReferencia(evento.target.value)} />
      </label>
      <label className="mz-confirmar">
        <input type="checkbox" checked={confirmado} onChange={(evento) => setConfirmado(evento.target.checked)} />
        <span><strong>Ya vi el pago aprobado</strong><small>Confirmo que el importe es {formatearPesos(total)}.</small></span>
      </label>
      <button type="submit" className="mz-cobrar mz-toque" disabled={!confirmado}>Registrar venta confirmada</button>
    </form>
  )
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function Fiado({
  total,
  onCobrar,
}: {
  total: number
  onCobrar: (clienteId: UUID, vence: number | null) => void
}) {
  const clientes = useLiveQuery(() => repos.clientes.todos(), [], [])
  // Lo que ya debe cada cliente, para mostrarlo y cuidar su límite.
  const deudas = useLiveQuery(async () => {
    const porCliente = new Map<UUID, number>()
    for (const fiado of await repos.fiados.abiertos()) porCliente.set(fiado.clienteId, (porCliente.get(fiado.clienteId) ?? 0) + fiado.saldo)
    return porCliente
  }, [], new Map<UUID, number>())
  const [pasado, setPasado] = useState<Cliente | null>(null)
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
    <div className="mz-cobro-cuerpo">
      <div className="mz-aviso-grande mz-aviso-arena">
        <strong>No se cobra ahora</strong>
        <span>La venta queda anotada en la cuenta del cliente.</span>
      </div>

      <label className="mz-campo">
        <span>Vencimiento <em>opcional</em></span>
        <input aria-label="Vencimiento del fiado" type="date" className="mz-entrada" value={vence} onChange={(evento) => setVence(evento.target.value)} />
      </label>

      {pasado && (
        <div className="mz-aviso-grande mz-aviso-coral" role="alertdialog" aria-label="Se pasa del límite de fiado">
          <strong>{pasado.nombre} se pasa de su límite</strong>
          <span>
            Debe {formatearPesos(deudas.get(pasado.id) ?? 0)} y su límite es {formatearPesos(pasado.limiteFiado ?? 0)}.
            Con esta venta quedaría en {formatearPesos((deudas.get(pasado.id) ?? 0) + total)}.
          </span>
          <div className="nb-acciones">
            <button type="button" className="libreta-button nb-boton nb-boton-secundario" onClick={() => setPasado(null)}>Elegir otro</button>
            <button type="button" className="libreta-button nb-boton nb-boton-principal" onClick={() => onCobrar(pasado.id, fechaVencimiento())}>Anotar igual</button>
          </div>
        </div>
      )}

      {!mostrarNuevo && !pasado && (
        <section aria-label="Elegir cliente">
          <label className="mz-campo">
            <span>Buscar cliente</span>
            <input
              aria-label="Buscar cliente"
              placeholder="Ej. Marta o 261…"
              className="mz-entrada"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              autoFocus
            />
          </label>
          <div className="mz-lista-clientes">
            {visibles.length === 0 ? (
              <p className="mz-vacio">No encontramos ese cliente.</p>
            ) : (
              visibles.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  className="mz-cliente mz-toque"
                  onClick={() => {
                    if (superaLimiteFiado(deudas.get(cliente.id) ?? 0, total, cliente.limiteFiado)) setPasado(cliente)
                    else onCobrar(cliente.id, fechaVencimiento())
                  }}
                  aria-label={`Anotar fiado a ${cliente.nombre}`}
                >
                  <span className="mz-cliente-iniciales" aria-hidden="true">{cliente.nombre.trim().slice(0, 2).toUpperCase()}</span>
                  <span className="mz-cliente-nombre">{cliente.nombre}</span>
                  {(deudas.get(cliente.id) ?? 0) > 0
                    ? <span className="mz-cliente-telefono">Debe {formatearPesos(deudas.get(cliente.id) ?? 0)}</span>
                    : cliente.telefono && <span className="mz-cliente-telefono">{cliente.telefono}</span>}
                </button>
              ))
            )}
          </div>
          <button type="button" className="mz-secundario mz-toque" onClick={() => setNuevo(true)}>
            <IconoNuevoCliente /> Nuevo cliente
          </button>
        </section>
      )}

      {mostrarNuevo && (
        <form onSubmit={crearCliente} aria-label="Nuevo cliente">
          <label className="mz-campo">
            <span>Nombre del cliente <em>obligatorio</em></span>
            <input
              aria-label="Nombre del cliente"
              autoFocus
              placeholder="Ej. Marta González"
              className="mz-entrada"
              value={nombre}
              onChange={(evento) => { setNombre(evento.target.value); setAviso(null) }}
            />
          </label>
          <label className="mz-campo">
            <span>Teléfono para WhatsApp <em>opcional</em></span>
            <input
              aria-label="Teléfono del cliente"
              inputMode="tel"
              placeholder="Ej. 261 555 1234"
              className="mz-entrada"
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
            />
          </label>
          <button type="submit" className="mz-cobrar mz-cobrar-arena mz-toque" disabled={guardando}>
            {guardando ? 'Guardando cliente…' : 'Anotar fiado'}
          </button>
          {hayClientes && (
            <button type="button" className="mz-secundario mz-toque" onClick={() => setNuevo(false)}>
              Elegir cliente existente
            </button>
          )}
        </form>
      )}

      {aviso && <p className="mz-aviso" role="alert">{aviso}</p>}
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
  const [pantalla, setPantalla] = useState<Pantalla>('efectivo')

  return (
    <div className="mz-cobro" role="dialog" aria-modal="true" aria-label="Cobrar la venta">
      <header className="mz-cobro-cabecera">
        <button type="button" className="mz-redondo mz-toque" aria-label="Cancelar el cobro" onClick={onCancelar}><IconoCerrar /></button>
        <h2>Cobrar</h2>
      </header>

      <div className="mz-cobro-total">
        <span>Total a cobrar</span>
        <strong className="tabular">{formatearPesos(total)}</strong>
      </div>

      <div className="mz-segmentos" role="group" aria-label="Forma de cobro">
        {SEGMENTOS.map(({ clave, visible, nombre }) => (
          <button
            key={clave}
            type="button"
            className="mz-segmento"
            aria-pressed={pantalla === clave}
            aria-label={nombre}
            onClick={() => setPantalla(clave)}
          >
            {visible}
          </button>
        ))}
      </div>

      {pantalla === 'efectivo' && <Efectivo total={total} onCobrar={() => onCobrar('efectivo')} />}
      {pantalla === 'fiado' && <Fiado total={total} onCobrar={(clienteId, vence) => onCobrar('fiado', clienteId, vence)} />}
      {(pantalla === 'transferencia' || pantalla === 'qr') && (
        <CobroDigital key={pantalla} medio={pantalla} total={total} onCobrar={(referencia) => onCobrar(pantalla, undefined, undefined, referencia)} />
      )}
    </div>
  )
}
