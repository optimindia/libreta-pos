'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, MedioPago, UUID } from '@/dominio/tipos'
import { superaLimiteFiado } from '@/dominio/fiado'
import { formatearPesos, pesosACentavos, vuelto } from '@/dominio/dinero'
import { conPuntos, soloDigitos, sugerenciasDePago, teclear, type TeclaCobro } from '@/dominio/cobro'
import { repos } from '@/datos/local/repos'
import { IconoBorrar, IconoNuevoCliente } from '@/ui/sistema/iconos'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton } from '@/ui/sistema/Boton'
import { Segmentado, type OpcionSegmentado } from '@/ui/sistema/Segmentado'
import { noSePudo } from '@/ui/sistema/textos'

export type MedioCobro = 'efectivo' | 'transferencia' | 'qr' | 'fiado'

/** "Cómo paga": el mismo control en el panel de la venta (PC) y en la hoja
 *  de cobro. El nombre accesible es la palabra completa; el texto corto
 *  sólo cabe mejor. */
export const OPCIONES_PAGO: OpcionSegmentado<MedioCobro>[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transf.', nombre: 'Transferencia' },
  { valor: 'qr', texto: 'QR' },
  { valor: 'fiado', texto: 'Fiado', tono: 'cuidado' },
]

const TECLAS: TeclaCobro[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'borrar']

/** Cobro en efectivo: cuánto te dan, cuánto es el vuelto y un teclado grande.
 *  Los botones de arriba ("Justo", $14.000…) resuelven el caso más común en
 *  un solo toque. */
function Efectivo({ total, onCobrar }: { total: number; onCobrar: (entregado: number) => void }) {
  const [pagoCon, setPagoCon] = useState('')
  const entregado = pesosACentavos(Number(pagoCon) || 0)
  const resto = vuelto(entregado, total)
  const hayPago = pagoCon !== ''
  const alcanza = hayPago && resto >= 0
  const justo = String(Math.ceil(total / 100))

  return (
    <form
      className="f-cobro"
      onSubmit={(evento) => { evento.preventDefault(); if (alcanza) onCobrar(entregado) }}
    >
      <div className="f-cobro-tablero">
        <label className="f-cobro-te-dan">
          <span className="f-cobro-rotulo">Te dan</span>
          <span className="f-cobro-monto">
            <span aria-hidden="true">$</span>
            <input
              aria-label="Con cuánto pagó"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              className="f-plata"
              value={conPuntos(pagoCon)}
              onChange={(evento) => setPagoCon(soloDigitos(evento.target.value))}
            />
          </span>
        </label>
        <div className="f-cobro-vuelto">
          <span className="f-cobro-rotulo">Vuelto</span>
          <strong className="f-plata">{alcanza ? formatearPesos(resto) : '—'}</strong>
        </div>
      </div>

      {hayPago && resto < 0 && (
        <p className="f-aviso" role="status">Le faltan {formatearPesos(-resto)} para cubrir la venta.</p>
      )}

      <div className="f-billetes">
        <button type="button" className="f-billete" aria-pressed={pagoCon === justo} onClick={() => setPagoCon(justo)}>Justo</button>
        {sugerenciasDePago(total).map((sugerido) => {
          const pesos = String(sugerido / 100)
          return (
            <button key={pesos} type="button" className="f-billete f-plata" aria-pressed={pagoCon === pesos} onClick={() => setPagoCon(pesos)}>
              {formatearPesos(sugerido)}
            </button>
          )
        })}
      </div>

      <div className="f-teclado" role="group" aria-label="Teclado numérico">
        {TECLAS.map((tecla) => (
          <button
            key={tecla}
            type="button"
            className="f-tecla-num"
            data-tecla={tecla}
            aria-label={tecla === 'borrar' ? 'Borrar' : tecla}
            onClick={() => setPagoCon((actual) => teclear(actual, tecla))}
          >
            {tecla === 'borrar' ? <IconoBorrar /> : tecla}
          </button>
        ))}
      </div>

      <Boton type="submit" variante="principal" tamano="grande" ancho className="f-cobro-confirmar" disabled={!alcanza}>
        <span>Cobrar {formatearPesos(total)}</span>
        {alcanza && resto > 0 && <small>{`y dar ${formatearPesos(resto)} de vuelto`}</small>}
      </Boton>
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
    <form className="f-cobro" onSubmit={(evento) => { evento.preventDefault(); if (confirmado) onCobrar(referencia) }}>
      <div className="f-aviso" data-tono="ambar">
        <strong>Mirá tu celu antes de cobrar</strong>
        <span>La app no puede saber si {medio === 'qr' ? 'un QR' : 'una transferencia'} ya se acreditó. Confirmá el comprobante antes de entregar la mercadería.</span>
      </div>
      <label className="f-campo">
        <span>Referencia o últimos dígitos <em>· opcional</em></span>
        <input aria-label="Referencia del pago" className="f-entrada" placeholder="Ej. 8472 o MP-1234" value={referencia} onChange={(evento) => setReferencia(evento.target.value)} />
      </label>
      <label className="f-confirmar">
        <input type="checkbox" checked={confirmado} onChange={(evento) => setConfirmado(evento.target.checked)} />
        <span><strong>Ya vi el pago aprobado</strong><small>Confirmo que el importe es {formatearPesos(total)}.</small></span>
      </label>
      <Boton type="submit" variante="principal" tamano="grande" ancho disabled={!confirmado}>Registrar venta confirmada</Boton>
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
      setAviso(noSePudo('guardar', 'el cliente'))
      setGuardando(false)
    }
  }

  return (
    <div className="f-cobro">
      <div className="f-aviso" data-tono="ambar">
        <strong>No se cobra ahora</strong>
        <span>La venta queda anotada en la cuenta del cliente.</span>
      </div>

      <label className="f-campo">
        <span>Vencimiento <em>· opcional</em></span>
        <input aria-label="Vencimiento del fiado" type="date" className="f-entrada" value={vence} onChange={(evento) => setVence(evento.target.value)} />
      </label>

      {pasado && (
        <div className="f-aviso f-cobro-limite" role="alertdialog" aria-label="Se pasa del límite de fiado">
          <strong>{pasado.nombre} se pasa de su límite</strong>
          <span>
            Debe {formatearPesos(deudas.get(pasado.id) ?? 0)} y su límite es {formatearPesos(pasado.limiteFiado ?? 0)}.
            Con esta venta quedaría en {formatearPesos((deudas.get(pasado.id) ?? 0) + total)}.
          </span>
          <div className="f-cobro-acciones">
            <Boton variante="secundario" onClick={() => setPasado(null)}>Elegir otro</Boton>
            <Boton variante="cuidado" onClick={() => onCobrar(pasado.id, fechaVencimiento())}>Anotar igual</Boton>
          </div>
        </div>
      )}

      {!mostrarNuevo && !pasado && (
        <section className="f-cobro-clientes" aria-label="Elegir cliente">
          <label className="f-campo">
            <span>Buscar cliente</span>
            <input
              aria-label="Buscar cliente"
              placeholder="Ej. Marta o 261…"
              className="f-entrada"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              autoFocus
            />
          </label>
          <div className="f-clientes">
            {visibles.length === 0 ? (
              <p className="f-hoja-ayuda">No encontramos ese cliente.</p>
            ) : (
              visibles.map((cliente) => {
                const debe = deudas.get(cliente.id) ?? 0
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    className="f-cliente"
                    onClick={() => {
                      if (superaLimiteFiado(debe, total, cliente.limiteFiado)) setPasado(cliente)
                      else onCobrar(cliente.id, fechaVencimiento())
                    }}
                    aria-label={`Anotar fiado a ${cliente.nombre}`}
                  >
                    <span className="f-cliente-inicial" data-debe={debe > 0 ? 'true' : 'false'} aria-hidden="true">{cliente.nombre.trim().slice(0, 1).toUpperCase()}</span>
                    <span className="f-renglon-cuerpo">
                      <span className="f-renglon-titulo">{cliente.nombre}</span>
                      {debe > 0
                        ? <span className="f-renglon-detalle" data-tono="coral">Debe {formatearPesos(debe)}</span>
                        : cliente.telefono && <span className="f-renglon-detalle">{cliente.telefono}</span>}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <Boton variante="secundario" ancho onClick={() => setNuevo(true)}>
            <IconoNuevoCliente /> Agregar cliente
          </Boton>
        </section>
      )}

      {mostrarNuevo && (
        <form className="f-cobro" onSubmit={crearCliente} aria-label="Nuevo cliente">
          <label className="f-campo">
            <span>Nombre del cliente <em>· obligatorio</em></span>
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
            <span>Teléfono para WhatsApp <em>· opcional</em></span>
            <input
              aria-label="Teléfono del cliente"
              inputMode="tel"
              placeholder="Ej. 261 555 1234"
              className="f-entrada"
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
            />
          </label>
          <Boton type="submit" variante="cuidado" tamano="grande" ancho disabled={guardando}>
            {guardando ? 'Guardando cliente…' : 'Anotar fiado'}
          </Boton>
          {hayClientes && (
            <Boton variante="secundario" ancho onClick={() => setNuevo(false)}>
              Elegir cliente existente
            </Boton>
          )}
        </form>
      )}

      {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
    </div>
  )
}

/** La hoja de cobro: el total arriba, "Cómo paga" y, según el medio, el
 *  teclado con el vuelto, la confirmación de la transferencia o el cliente
 *  del fiado. */
export function Cobro({
  total,
  medioInicial = 'efectivo',
  onCobrar,
  onCancelar,
}: {
  total: number
  /** El medio que ya se eligió en el panel de la venta (PC). */
  medioInicial?: MedioCobro
  onCobrar: (medio: MedioPago, clienteId?: UUID, vence?: number | null, referenciaPago?: string, pagoCon?: number) => void
  onCancelar: () => void
}) {
  const [pantalla, setPantalla] = useState<MedioCobro>(medioInicial)

  return (
    <Hoja abierta onCerrar={onCancelar} titulo="Cobrar" extra={formatearPesos(total)} etiquetaCerrar="Cancelar el cobro" ancho="angosto">
      <Segmentado etiqueta="Cómo paga" opciones={OPCIONES_PAGO} valor={pantalla} onCambiar={setPantalla} />

      {pantalla === 'efectivo' && <Efectivo total={total} onCobrar={(entregado) => onCobrar('efectivo', undefined, undefined, undefined, entregado)} />}
      {pantalla === 'fiado' && <Fiado total={total} onCobrar={(clienteId, vence) => onCobrar('fiado', clienteId, vence)} />}
      {(pantalla === 'transferencia' || pantalla === 'qr') && (
        <CobroDigital key={pantalla} medio={pantalla} total={total} onCobrar={(referencia) => onCobrar(pantalla, undefined, undefined, referencia)} />
      )}
    </Hoja>
  )
}
