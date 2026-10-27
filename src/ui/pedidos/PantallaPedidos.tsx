'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, EstadoPedido, MedioPago, Pedido } from '@/dominio/tipos'
import { COLOR_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, fechaPedidoCorta, siguienteEstadoPedido, unidadesPedido } from '@/dominio/pedidos'
import { normalizarTexto } from '@/dominio/validaciones'
import { formatearPesos } from '@/dominio/dinero'
import { mensajePedido, enlaceWhatsApp } from '@/dominio/mensajes'
import { repos } from '@/datos/local/repos'
import { db } from '@/datos/local/db'
import { Boton } from '@/ui/sistema/Boton'
import { Importe } from '@/ui/sistema/Importe'
import { IconoAlerta, IconoCalendario, IconoCobrar, IconoConfirmar, IconoEntrega, IconoFiltro, IconoNota, IconoPedidos, IconoQR, IconoTransferencia, IconoUbicacion } from '@/ui/sistema/iconos'
import { FormularioPedido } from './FormularioPedido'

type FiltroPedido = 'todos' | EstadoPedido

const FILTROS: FiltroPedido[] = ['todos', 'pendiente', 'preparando', 'listo', 'entregado', 'cancelado']
const MEDIOS_COBRO: Array<{ medio: MedioPago; texto: string }> = [
  { medio: 'efectivo', texto: 'Efectivo' },
  { medio: 'transferencia', texto: 'Transferencia' },
  { medio: 'qr', texto: 'QR' },
  { medio: 'fiado', texto: 'Fiado' },
]

function esHoy(epoch: number | null): boolean {
  if (!epoch) return false
  const hoy = new Date()
  const fecha = new Date(epoch)
  return hoy.getFullYear() === fecha.getFullYear() && hoy.getMonth() === fecha.getMonth() && hoy.getDate() === fecha.getDate()
}

function etiquetaTipoEntrega(pedido: Pedido): string {
  return pedido.tipoEntrega === 'envio' ? 'Envío' : 'Retiro'
}

function nombreCliente(cliente: Cliente | undefined): string {
  return cliente?.nombre || 'Cliente mostrador'
}

export function PantallaPedidos() {
  const [filtro, setFiltro] = useState<FiltroPedido>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [formulario, setFormulario] = useState(false)
  const [editando, setEditando] = useState<Pedido | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const datos = useLiveQuery(async () => {
    const [pedidos, productos, clientes, negocio] = await Promise.all([
      repos.pedidos.todos(),
      repos.productos.todos(),
      repos.clientes.todos(),
      db.negocio.get('unico'),
    ])
    return { pedidos, productos, clientes, negocio, reservadas: await repos.pedidos.reservadasPorProducto() }
  }, [], { pedidos: [], productos: [], clientes: [], negocio: undefined, reservadas: new Map<string, number>() })

  const clientesPorId = useMemo(() => new Map(datos.clientes.map((cliente) => [cliente.id, cliente])), [datos.clientes])
  const aguja = normalizarTexto(busqueda)
  const visibles = useMemo(() => datos.pedidos.filter((pedido) => {
    if (filtro !== 'todos' && pedido.estado !== filtro) return false
    if (!aguja) return true
    const cliente = clientesPorId.get(pedido.clienteId ?? '')
    return normalizarTexto(`${pedido.id} ${cliente?.nombre ?? ''} ${cliente?.telefono ?? ''} ${pedido.items.map((item) => item.nombre).join(' ')} ${pedido.nota ?? ''}`).includes(aguja)
  }), [aguja, clientesPorId, datos.pedidos, filtro])

  const activos = datos.pedidos.filter((pedido) => pedido.estado !== 'entregado' && pedido.estado !== 'cancelado')
  const paraHoy = activos.filter((pedido) => esHoy(pedido.fechaEntrega)).length
  const listos = datos.pedidos.filter((pedido) => pedido.estado === 'listo').length
  const reservadas = [...datos.reservadas.values()].reduce((suma, cantidad) => suma + cantidad, 0)
  const valorActivo = activos.reduce((suma, pedido) => suma + pedido.total, 0)

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    try {
      await repos.pedidos.actualizarEstado(pedido.id, estado)
      setAviso(`${ETIQUETA_ESTADO_PEDIDO[estado]}: ${nombreCliente(clientesPorId.get(pedido.clienteId ?? ''))}.`)
    } catch {
      setAviso('No se pudo actualizar el estado del pedido.')
    }
  }

  async function cancelar(pedido: Pedido) {
    if (!window.confirm('¿Cancelar este pedido? Si tenía reserva, las unidades quedan disponibles de nuevo.')) return
    try {
      await repos.pedidos.cancelar(pedido.id)
      setAviso('Pedido cancelado y reserva liberada.')
    } catch {
      setAviso('No se pudo cancelar el pedido.')
    }
  }

  async function cobrar(pedido: Pedido, medio: MedioPago) {
    try {
      await repos.pedidos.convertirEnVenta(pedido.id, medio)
      setAviso(`Pedido de ${nombreCliente(clientesPorId.get(pedido.clienteId ?? ''))} cobrado y entregado.`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo cobrar el pedido.')
      throw error
    }
  }

  return (
    <div className="page-pedidos px-5 pt-6">
      <div className="page-module-head pedidos-head">
        <div><span className="page-kicker">Operación inteligente</span><h1 className="page-title">Pedidos</h1><p className="page-description">Guardá encargos, reservá mercadería y cobrá cuando estén listos.</p></div>
        <Boton variante="principal" className="button-with-icon pedidos-new-button" onClick={() => { setEditando(null); setFormulario(true); setAviso(null) }}><IconoPedidos /> Nuevo pedido</Boton>
      </div>

      <section className="pedidos-command-card" aria-label="Resumen de pedidos">
        <div className="pedidos-command-copy"><span className="pedidos-command-icon"><IconoPedidos /></span><div><strong>{activos.length === 0 ? 'Tu agenda está despejada' : `${activos.length} ${activos.length === 1 ? 'pedido activo' : 'pedidos activos'}`}</strong><p>{paraHoy > 0 ? `${paraHoy} requieren atención hoy.` : 'Todo lo que encargaron queda ordenado en un solo lugar.'}</p></div></div>
        <div className="pedidos-command-total"><span>Valor en agenda</span><strong>{formatearPesos(valorActivo)}</strong></div>
      </section>

      <div className="pedidos-metrics">
        <button type="button" className={`pedidos-metric${filtro === 'pendiente' ? ' is-selected' : ''}`} onClick={() => setFiltro('pendiente')}><span>Pendientes</span><strong>{datos.pedidos.filter((pedido) => pedido.estado === 'pendiente').length}</strong><small>por preparar</small></button>
        <button type="button" className={`pedidos-metric${filtro === 'preparando' ? ' is-selected' : ''}`} onClick={() => setFiltro('preparando')}><span>En marcha</span><strong>{datos.pedidos.filter((pedido) => pedido.estado === 'preparando').length}</strong><small>preparando</small></button>
        <button type="button" className={`pedidos-metric${filtro === 'listo' ? ' is-selected' : ''}`} onClick={() => setFiltro('listo')}><span>Listos</span><strong>{listos}</strong><small>para entregar</small></button>
        <div className="pedidos-metric"><span>Stock reservado</span><strong>{reservadas}</strong><small>unidades bloqueadas</small></div>
      </div>

      {formulario && <FormularioPedido pedido={editando} productos={datos.productos} clientes={datos.clientes} reservadas={datos.reservadas} onGuardado={(pedido) => { setFormulario(false); setEditando(null); setAviso(pedido.id === editando?.id ? 'Cambios guardados.' : 'Pedido creado. Ya aparece en tu agenda.') }} onCancel={() => { setFormulario(false); setEditando(null) }} />}
      {aviso && <div className="pedidos-notice" role="status"><IconoConfirmar /><span>{aviso}</span><button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button></div>}

      <div className="pedidos-toolbar">
        <label className="pedidos-search"><IconoFiltro /><input aria-label="Buscar pedidos" placeholder="Buscar cliente, producto o número…" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} /></label>
        <div className="pedidos-filter-scroll">{FILTROS.map((opcion) => <button type="button" key={opcion} className={filtro === opcion ? 'is-selected' : ''} onClick={() => setFiltro(opcion)}>{opcion === 'todos' ? 'Todos' : ETIQUETA_ESTADO_PEDIDO[opcion]}</button>)}</div>
      </div>

      {visibles.length === 0 ? <section className="pedidos-empty"><span className="pedidos-empty-icon"><IconoPedidos /></span><span className="page-kicker">Agenda limpia</span><h2>{datos.pedidos.length === 0 ? 'Tus pedidos van a vivir acá' : 'No encontramos coincidencias'}</h2><p>{datos.pedidos.length === 0 ? 'Anotá encargos de WhatsApp, teléfono o mostrador y seguí cada paso sin perder nada.' : 'Probá con otro cliente, producto o estado.'}</p>{datos.pedidos.length === 0 && <Boton variante="principal" className="button-with-icon" onClick={() => setFormulario(true)}><IconoPedidos /> Crear primer pedido</Boton>}</section> : <div className="pedidos-list">{visibles.map((pedido) => <PedidoCard key={pedido.id} pedido={pedido} cliente={clientesPorId.get(pedido.clienteId ?? '')} onEditar={() => { setEditando(pedido); setFormulario(true); setAviso(null) }} onCambiarEstado={(estado) => void cambiarEstado(pedido, estado)} onCancelar={() => void cancelar(pedido)} onCobrar={(medio) => cobrar(pedido, medio)} negocio={datos.negocio} />)}</div>}

      <div className="pedidos-footer-tip"><IconoAlerta /><span><strong>Una reserva no descuenta stock.</strong> Sólo bloquea unidades hasta cobrar o cancelar; así podés seguir viendo tu inventario real.</span></div>
    </div>
  )
}

function PedidoCard({
  pedido,
  cliente,
  onEditar,
  onCambiarEstado,
  onCancelar,
  onCobrar,
  negocio,
}: {
  pedido: Pedido
  cliente?: Cliente
  onEditar: () => void
  onCambiarEstado: (estado: EstadoPedido) => void
  onCancelar: () => void
  onCobrar: (medio: MedioPago) => Promise<void>
  negocio: { nombre: string } | undefined
}) {
  const [mostrarCobro, setMostrarCobro] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const siguiente = siguienteEstadoPedido(pedido.estado)
  const siguienteAccion = siguiente && siguiente !== 'entregado' ? siguiente : null
  const etiquetaSiguiente = siguienteAccion ? (siguienteAccion === 'preparando' ? 'Empezar a preparar' : 'Marcar listo') : null

  async function cobrarPedido(medio: MedioPago) {
    setProcesando(true)
    try {
      await onCobrar(medio)
      setMostrarCobro(false)
    } catch {
      // El mensaje visible lo deja la pantalla padre.
    } finally {
      setProcesando(false)
    }
  }

  return (
    <article className={`pedido-card pedido-card-${pedido.estado}`}>
      <div className="pedido-card-top"><div className="pedido-card-person"><span className="pedido-card-avatar">{cliente?.nombre?.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || '•'}</span><div><strong>{cliente?.nombre || 'Cliente mostrador'}</strong><small>Pedido #{pedido.id.slice(0, 6).toUpperCase()} · {new Date(pedido.fecha).toLocaleDateString('es-AR')}</small></div></div><span className={`pedido-status pedido-status-${COLOR_ESTADO_PEDIDO[pedido.estado]}`}><span />{ETIQUETA_ESTADO_PEDIDO[pedido.estado]}</span></div>
      <div className="pedido-card-info"><span><IconoEntrega />{etiquetaTipoEntrega(pedido)}</span>{pedido.fechaEntrega && <span className={esHoy(pedido.fechaEntrega) ? 'is-today' : ''}><IconoCalendario />{esHoy(pedido.fechaEntrega) ? 'Hoy' : fechaPedidoCorta(pedido.fechaEntrega)}</span>}{pedido.tipoEntrega === 'envio' && <span><IconoUbicacion />{pedido.direccion}</span>}</div>
      <ul className="pedido-card-items">{pedido.items.slice(0, 4).map((item) => <li key={item.productoId}><span>{item.cantidad} × {item.nombre}</span><Importe centavos={item.precio * item.cantidad} tamaño="chico" /></li>)}{pedido.items.length > 4 && <li className="pedido-more-items">+ {pedido.items.length - 4} productos más</li>}</ul>
      {pedido.nota && <div className="pedido-card-note"><IconoNota /><span>{pedido.nota}</span></div>}
      <div className="pedido-card-total"><span>{unidadesPedido(pedido.items)} unidades{pedido.reservarStock ? ' · stock reservado' : ''}</span><strong><Importe centavos={pedido.total} tamaño="normal" /></strong></div>

      {mostrarCobro && <div className="pedido-payment-box"><div><strong>Cobrar y entregar</strong><small>Elegí cómo ingresó el pago</small></div><div className="pedido-payment-actions">{MEDIOS_COBRO.map(({ medio, texto }) => <button type="button" key={medio} disabled={procesando} onClick={() => void cobrarPedido(medio)}>{medio === 'efectivo' ? <IconoCobrar /> : medio === 'transferencia' ? <IconoTransferencia /> : medio === 'qr' ? <IconoQR /> : <span className="pedido-payment-fiado">$</span>}{texto}</button>)}</div></div>}

      <div className="pedido-card-actions">{siguienteAccion && etiquetaSiguiente && <Boton variante="principal" className="button-with-icon pedido-action-main" onClick={() => onCambiarEstado(siguienteAccion)}><IconoConfirmar /> {etiquetaSiguiente}</Boton>}{pedido.estado === 'listo' && <Boton variante="principal" className="button-with-icon pedido-action-main" onClick={() => setMostrarCobro((actual) => !actual)}><IconoCobrar /> {mostrarCobro ? 'Cerrar cobro' : 'Cobrar y entregar'}</Boton>}{pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && <button type="button" className="pedido-action-secondary" onClick={onEditar}>Editar</button>}{cliente?.telefono && <a className="pedido-action-secondary" target="_blank" rel="noreferrer" href={enlaceWhatsApp(cliente.telefono, mensajePedido(negocio ? { id: 'unico', nombre: negocio.nombre, logo: null, color: null } : { id: 'unico', nombre: 'Tu almacén', logo: null, color: null }, pedido, cliente))}>WhatsApp</a>}{pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && <button type="button" className="pedido-action-danger" onClick={onCancelar}>Cancelar</button>}</div>
    </article>
  )
}
