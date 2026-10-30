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
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Etiqueta, type TonoEtiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoPedidos, IconoCalendario, IconoCerrar, IconoCobrar, IconoConfirmar, IconoEntrega, IconoNota, IconoQR, IconoTransferencia, IconoUbicacion } from '@/ui/sistema/iconos'
import { FormularioPedido } from './FormularioPedido'
import './pedidos.css'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { TEXTOS, noSePudo } from '@/ui/sistema/textos'

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
  const reservadas = [...datos.reservadas.values()].reduce((suma, cantidad) => suma + cantidad, 0)
  const valorActivo = activos.reduce((suma, pedido) => suma + pedido.total, 0)
  const cuenta = (estado: EstadoPedido) => datos.pedidos.filter((pedido) => pedido.estado === estado).length

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    try {
      await repos.pedidos.actualizarEstado(pedido.id, estado)
      setAviso(`${ETIQUETA_ESTADO_PEDIDO[estado]}: ${nombreCliente(clientesPorId.get(pedido.clienteId ?? ''))}.`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo cambiar el estado del pedido. Probá de nuevo.')
    }
  }

  async function cancelar(pedido: Pedido) {
    if (!window.confirm('¿Cancelar este pedido? Si tenía reserva, las unidades quedan disponibles de nuevo.')) return
    try {
      await repos.pedidos.cancelar(pedido.id)
      setAviso('Pedido cancelado y reserva liberada.')
    } catch {
      setAviso(noSePudo('cancelar', 'el pedido'))
    }
  }

  async function cobrar(pedido: Pedido, medio: MedioPago) {
    try {
      await repos.pedidos.convertirEnVenta(pedido.id, medio)
      setAviso(`Pedido de ${nombreCliente(clientesPorId.get(pedido.clienteId ?? ''))} cobrado y entregado.`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : noSePudo('cobrar', 'el pedido'))
      throw error
    }
  }

  return (
    <div className="page-pedidos f-pedidos">
      <header className="f-pedidos-cabeza">
        <div>
          <h1 className="f-titulo">Pedidos</h1>
          <p className="f-pedidos-sub">Guardá encargos, reservá mercadería y cobrá cuando estén listos.</p>
        </div>
        <Boton variante="principal" onClick={() => { setEditando(null); setFormulario(true); setAviso(null) }}>
          + {TEXTOS.agregarPedido}
        </Boton>
      </header>

      <section className="f-pedidos-resumen" aria-label="Resumen de pedidos">
        <div className="f-pedidos-agenda">
          <span className="f-pedidos-agenda-texto">
            <span className="f-pedidos-agenda-rotulo">Valor en agenda</span>
            <span className="f-dato">
              {activos.length === 0 ? 'Tu agenda está despejada' : `${activos.length} ${activos.length === 1 ? 'pedido activo' : 'pedidos activos'}`}
              {paraHoy > 0 ? ` · ${paraHoy} para hoy` : ''}
            </span>
          </span>
          <b className="f-plata f-pedidos-agenda-monto">{formatearPesos(valorActivo)}</b>
        </div>
        <div className="f-pedidos-reserva">
          <b>{reservadas}</b>
          <span className="f-dato">{reservadas === 1 ? 'unidad reservada' : 'unidades reservadas'}</span>
        </div>
      </section>

      {aviso && (
        <div className="f-aviso f-pedidos-aviso" role="status" data-tono="ambar">
          <IconoConfirmar />
          <span>{aviso}</span>
          <button type="button" className="f-icono-boton" onClick={() => setAviso(null)} aria-label="Cerrar aviso"><IconoCerrar /></button>
        </div>
      )}

      <div className="f-pedidos-filtros">
        <CampoBusqueda etiqueta="Buscar pedidos" placeholder="Buscar cliente, producto o número" valor={busqueda} onCambiar={setBusqueda} />
        <Chips etiqueta="Filtrar pedidos por estado">
          {FILTROS.map((opcion) => (
            <Chip key={opcion} activo={filtro === opcion} onClick={() => setFiltro(opcion)}>
              {opcion === 'todos' ? 'Todos' : ETIQUETA_ESTADO_PEDIDO[opcion]}
              {(opcion === 'pendiente' || opcion === 'preparando' || opcion === 'listo') && <span className="f-pedidos-cuenta">{cuenta(opcion)}</span>}
            </Chip>
          ))}
        </Chips>
      </div>

      {visibles.length === 0 ? (
        datos.pedidos.length === 0 ? (
          <EstadoVacio
            icono={<IconoPedidos />}
            titulo="Todavía no tenés pedidos"
            texto="Anotá los encargos de WhatsApp, teléfono o mostrador y seguí cada paso sin perder nada."
            accion={{ etiqueta: TEXTOS.agregarPedido, alTocar: () => setFormulario(true) }}
          />
        ) : (
          <EstadoVacio titulo="No encontramos pedidos" texto="Probá con otro cliente, producto o estado." />
        )
      ) : (
        <ul className="f-pedidos-lista">
          {visibles.map((pedido) => (
            <li key={pedido.id}>
              <PedidoCard pedido={pedido} cliente={clientesPorId.get(pedido.clienteId ?? '')} onEditar={() => { setEditando(pedido); setFormulario(true); setAviso(null) }} onCambiarEstado={(estado) => void cambiarEstado(pedido, estado)} onCancelar={() => void cancelar(pedido)} onCobrar={(medio) => cobrar(pedido, medio)} negocio={datos.negocio} />
            </li>
          ))}
        </ul>
      )}

      <div className="f-aviso f-pedidos-tip" data-tono="ambar">
        <strong>Una reserva no descuenta stock.</strong>
        <span>Sólo bloquea unidades hasta cobrar o cancelar; así podés seguir viendo tu inventario real.</span>
      </div>

      {formulario && <FormularioPedido pedido={editando} productos={datos.productos} clientes={datos.clientes} reservadas={datos.reservadas} onGuardado={(pedido) => { setFormulario(false); setEditando(null); setAviso(pedido.id === editando?.id ? 'Cambios guardados.' : 'Pedido creado. Ya aparece en tu agenda.') }} onCancel={() => { setFormulario(false); setEditando(null) }} />}
    </div>
  )
}

const TONO_ESTADO: Record<'verde' | 'ambar' | 'tenue', TonoEtiqueta> = {
  verde: 'verde',
  ambar: 'ambar',
  tenue: 'gris',
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
  const abierto = pedido.estado !== 'entregado' && pedido.estado !== 'cancelado'

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
    <Tarjeta como="article" relleno="normal" className="f-pedidos-tarjeta" data-estado={pedido.estado}>
      <div className="f-pedidos-top">
        <span className="f-pedidos-avatar" aria-hidden="true">{cliente?.nombre?.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || '•'}</span>
        <span className="f-renglon-cuerpo">
          <span className="f-renglon-titulo">{cliente?.nombre || 'Cliente mostrador'}</span>
          <span className="f-renglon-detalle">Pedido #{pedido.id.slice(0, 6).toUpperCase()} · {new Date(pedido.fecha).toLocaleDateString('es-AR')}</span>
        </span>
        <Etiqueta tono={TONO_ESTADO[COLOR_ESTADO_PEDIDO[pedido.estado]]} punto>{ETIQUETA_ESTADO_PEDIDO[pedido.estado]}</Etiqueta>
      </div>

      <div className="f-pedidos-info">
        <Etiqueta><IconoEntrega />{etiquetaTipoEntrega(pedido)}</Etiqueta>
        {pedido.fechaEntrega && <Etiqueta tono={esHoy(pedido.fechaEntrega) ? 'ambar' : 'gris'}><IconoCalendario />{esHoy(pedido.fechaEntrega) ? 'Hoy' : fechaPedidoCorta(pedido.fechaEntrega)}</Etiqueta>}
        {pedido.tipoEntrega === 'envio' && <Etiqueta className="f-pedidos-direccion"><IconoUbicacion />{pedido.direccion}</Etiqueta>}
      </div>

      <ul className="f-pedidos-items">
        {pedido.items.slice(0, 4).map((item) => (
          <li key={item.productoId}><span>{item.cantidad} × {item.nombre}</span><b>{formatearPesos(item.precio * item.cantidad)}</b></li>
        ))}
        {pedido.items.length > 4 && <li className="f-pedidos-mas">+ {pedido.items.length - 4} productos más</li>}
      </ul>

      {pedido.nota && <p className="f-pedidos-nota"><IconoNota /><span>{pedido.nota}</span></p>}

      <div className="f-pedidos-total">
        <span className="f-dato">{unidadesPedido(pedido.items)} {unidadesPedido(pedido.items) === 1 ? 'unidad' : 'unidades'}{pedido.reservarStock ? ' · stock reservado' : ''}</span>
        <b className="f-plata-16 f-pedidos-total-monto">{formatearPesos(pedido.total)}</b>
      </div>

      <div className="f-pedidos-acciones">
        {siguienteAccion && etiquetaSiguiente && <Boton variante="secundario" className="f-pedidos-siguiente" onClick={() => onCambiarEstado(siguienteAccion)}><IconoConfirmar /> {etiquetaSiguiente}</Boton>}
        {pedido.estado === 'listo' && <Boton variante="secundario" className="f-pedidos-siguiente" onClick={() => setMostrarCobro(true)}><IconoCobrar /> Cobrar y entregar</Boton>}
        {abierto && <Boton variante="secundario" onClick={onEditar}>Editar</Boton>}
        {cliente?.telefono && <a data-tamano="normal" className={clasesBoton('secundario')} target="_blank" rel="noreferrer" href={enlaceWhatsApp(cliente.telefono, mensajePedido(negocio ? { id: 'unico', nombre: negocio.nombre, logo: null, color: null } : { id: 'unico', nombre: 'Tu almacén', logo: null, color: null }, pedido, cliente))}>WhatsApp</a>}
        {abierto && <Boton variante="cuidado" onClick={onCancelar}>Cancelar</Boton>}
      </div>

      <Hoja abierta={mostrarCobro} onCerrar={() => { if (!procesando) setMostrarCobro(false) }} titulo="Cobrar y entregar" extra={formatearPesos(pedido.total)} ancho="angosto">
        <p className="f-hoja-ayuda">Elegí cómo ingresó el pago de <b>{cliente?.nombre || 'Cliente mostrador'}</b>.</p>
        <div className="f-pedidos-medios">
          {MEDIOS_COBRO.map(({ medio, texto }) => (
            <Boton key={medio} variante={medio === 'fiado' ? 'cuidado' : 'secundario'} tamano="grande" disabled={procesando} onClick={() => void cobrarPedido(medio)}>
              {medio === 'efectivo' ? <IconoCobrar /> : medio === 'transferencia' ? <IconoTransferencia /> : medio === 'qr' ? <IconoQR /> : <span aria-hidden="true">$</span>}
              {texto}
            </Boton>
          ))}
        </div>
      </Hoja>
    </Tarjeta>
  )
}
