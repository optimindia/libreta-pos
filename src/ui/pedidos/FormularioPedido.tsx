'use client'

import { useMemo, useState } from 'react'
import type { Cliente, ItemPedido, Pedido, Producto, TipoEntrega } from '@/dominio/tipos'
import { agregarItemPedido, cambiarCantidadPedido, totalPedido } from '@/dominio/pedidos'
import { precioVigente, tieneOfertaVigente } from '@/dominio/ticket'
import { normalizarTexto } from '@/dominio/validaciones'
import { formatearPesos } from '@/dominio/dinero'
import { ErrorStockInsuficiente, repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { IconoClientes, IconoConfirmar, IconoEntrega, IconoUbicacion } from '@/ui/sistema/iconos'
import './pedidos.css'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { noSePudo } from '@/ui/sistema/textos'

function fechaInput(epoch: number | null | undefined): string {
  return epoch ? new Date(epoch).toISOString().slice(0, 10) : ''
}

function fechaDesdeInput(valor: string): number | null {
  if (!valor) return null
  const fecha = new Date(`${valor}T23:59:59`).getTime()
  return Number.isFinite(fecha) ? fecha : null
}

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join('')
}

export function FormularioPedido({
  pedido,
  productos,
  clientes,
  reservadas,
  onGuardado,
  onCancel,
}: {
  pedido?: Pedido | null
  productos: Producto[]
  clientes: Cliente[]
  reservadas: Map<string, number>
  onGuardado: (pedido: Pedido) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<ItemPedido[]>(pedido?.items ?? [])
  const [clienteId, setClienteId] = useState(pedido?.clienteId ?? '')
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>(pedido?.tipoEntrega ?? 'retiro')
  const [fechaEntrega, setFechaEntrega] = useState(fechaInput(pedido?.fechaEntrega))
  const [direccion, setDireccion] = useState(pedido?.direccion ?? '')
  const [nota, setNota] = useState(pedido?.nota ?? '')
  const [reservarStock, setReservarStock] = useState(pedido?.reservarStock ?? true)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [telefonoNuevo, setTelefonoNuevo] = useState('')
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const productosVisibles = useMemo(() => {
    const aguja = normalizarTexto(busquedaProducto)
    return productos
      .filter((producto) => aguja === '' || normalizarTexto(`${producto.nombre} ${producto.codigoBarras ?? ''} ${producto.categoria ?? ''}`).includes(aguja))
      .sort((a, b) => Number(b.favorito) - Number(a.favorito) || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 8)
  }, [busquedaProducto, productos])

  const clientesVisibles = useMemo(() => {
    const aguja = normalizarTexto(busquedaCliente)
    return clientes.filter((cliente) => aguja === '' || normalizarTexto(`${cliente.nombre} ${cliente.telefono ?? ''}`).includes(aguja)).slice(0, 6)
  }, [busquedaCliente, clientes])

  const total = totalPedido(items)
  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)
  const clienteElegido = clientes.find((cliente) => cliente.id === clienteId)

  async function crearClienteRapido() {
    if (nombreNuevo.trim().length < 2) {
      setAviso('Escribí el nombre del cliente.')
      return
    }
    setGuardandoCliente(true)
    setAviso(null)
    try {
      const cliente = await repos.clientes.guardar({ nombre: nombreNuevo.trim(), telefono: telefonoNuevo.trim() || null })
      setClienteId(cliente.id)
      setNuevoCliente(false)
      setNombreNuevo('')
      setTelefonoNuevo('')
      setBusquedaCliente('')
    } catch {
      setAviso(noSePudo('guardar', 'el cliente'))
    } finally {
      setGuardandoCliente(false)
    }
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (items.length === 0) {
      setAviso('Sumá al menos un producto al pedido.')
      return
    }
    if (tipoEntrega === 'envio' && direccion.trim().length < 3) {
      setAviso('Escribí una dirección para preparar el envío.')
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      const guardado = await repos.pedidos.guardar({
        id: pedido?.id,
        estado: pedido?.estado === 'entregado' || pedido?.estado === 'cancelado' ? 'pendiente' : pedido?.estado ?? 'pendiente',
        clienteId: clienteId || null,
        items,
        tipoEntrega,
        fechaEntrega: fechaDesdeInput(fechaEntrega),
        direccion: tipoEntrega === 'envio' ? direccion : null,
        nota,
        reservarStock,
        ventaId: pedido?.ventaId,
      })
      onGuardado(guardado)
    } catch (error) {
      if (error instanceof ErrorStockInsuficiente) {
        setAviso(`No hay unidades suficientes de ${error.producto}. Disponibles para reservar: ${error.disponible}.`)
      } else {
        setAviso(noSePudo('guardar', 'el pedido'))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta onCerrar={onCancel} titulo={pedido ? 'Editar pedido' : 'Nuevo pedido'}>
      <form className="f-pedidos-form" onSubmit={(evento) => void guardar(evento)}>
        <p className="f-hoja-ayuda">Organizá lo que te encargaron y convertilo en venta cuando se retire.</p>

        <section className="f-pedidos-paso" aria-labelledby="pedido-paso-cliente">
          <h3 id="pedido-paso-cliente" className="f-pedidos-paso-titulo"><span aria-hidden="true">1</span>Cliente</h3>
          {!nuevoCliente ? (
            <>
              <label className="f-campo">
                <span>Buscar cliente <em>opcional</em></span>
                <input aria-label="Buscar cliente del pedido" className="f-entrada" placeholder="Nombre o teléfono…" value={busquedaCliente} onChange={(evento) => setBusquedaCliente(evento.target.value)} />
              </label>
              <div className="f-pedidos-opciones">
                <button type="button" className="f-pedidos-opcion" aria-pressed={clienteId === ''} onClick={() => setClienteId('')}>
                  <span className="f-pedidos-avatar" aria-hidden="true">•</span>
                  <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">Sin cliente</span><span className="f-renglon-detalle">Pedido mostrador</span></span>
                  {clienteId === '' && <IconoConfirmar />}
                </button>
                {clientesVisibles.map((cliente) => (
                  <button type="button" key={cliente.id} className="f-pedidos-opcion" aria-pressed={clienteId === cliente.id} onClick={() => setClienteId(cliente.id)}>
                    <span className="f-pedidos-avatar" aria-hidden="true">{iniciales(cliente.nombre)}</span>
                    <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{cliente.nombre}</span><span className="f-renglon-detalle">{cliente.telefono || 'Sin teléfono'}</span></span>
                    {clienteId === cliente.id && <IconoConfirmar />}
                  </button>
                ))}
              </div>
              <Boton type="button" variante="secundario" onClick={() => setNuevoCliente(true)}><IconoClientes /> Agregar cliente</Boton>
              {clienteElegido && <p className="f-dato">Pedido asociado a {clienteElegido.nombre}.</p>}
            </>
          ) : (
            <div className="f-pedidos-nuevo-cliente">
              <div className="f-pedidos-nuevo-cabeza">
                <strong>Nuevo cliente</strong>
                <button type="button" className="f-pedidos-enlace" onClick={() => setNuevoCliente(false)}>Elegir existente</button>
              </div>
              <label className="f-campo">
                <span>Nombre <em>obligatorio</em></span>
                <input autoFocus aria-label="Nombre del nuevo cliente" className="f-entrada" placeholder="Ej. Marta González" value={nombreNuevo} onChange={(evento) => setNombreNuevo(evento.target.value)} />
              </label>
              <label className="f-campo">
                <span>WhatsApp <em>opcional</em></span>
                <input aria-label="Teléfono del nuevo cliente" inputMode="tel" className="f-entrada" placeholder="261 555 1234" value={telefonoNuevo} onChange={(evento) => setTelefonoNuevo(evento.target.value)} />
              </label>
              <Boton type="button" variante="secundario" disabled={guardandoCliente} onClick={() => void crearClienteRapido()}>{guardandoCliente ? 'Guardando…' : 'Guardar y vincular'}</Boton>
            </div>
          )}
        </section>

        <section className="f-pedidos-paso" aria-labelledby="pedido-paso-productos">
          <h3 id="pedido-paso-productos" className="f-pedidos-paso-titulo"><span aria-hidden="true">2</span>Productos</h3>
          <label className="f-campo">
            <span>Agregar producto</span>
            <input aria-label="Buscar producto para pedido" className="f-entrada" placeholder="Nombre, código o categoría…" value={busquedaProducto} onChange={(evento) => setBusquedaProducto(evento.target.value)} />
          </label>
          {busquedaProducto.trim() !== '' && (
            <div className="f-pedidos-opciones">
              {productosVisibles.length === 0 ? <EstadoVacio compacto titulo="No encontramos ese producto" texto="Probá con otro nombre o cargalo primero en Stock." /> : productosVisibles.map((producto) => {
                const disponible = Math.max(0, producto.stock - (reservadas.get(producto.id) ?? 0) + (pedido?.reservarStock && pedidoReservaDelProducto(pedido, producto.id) ? pedidoCantidad(pedido, producto.id) : 0))
                return (
                  <button type="button" key={producto.id} className="f-pedidos-opcion" disabled={disponible <= 0} onClick={() => { setItems((actuales) => agregarItemPedido(actuales, producto)); setBusquedaProducto(''); setAviso(null) }}>
                    <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{producto.nombre}</span><span className="f-renglon-detalle">{disponible > 0 ? `${disponible} disponibles para reservar` : 'Sin unidades disponibles'}</span></span>
                    <span className="f-pedidos-precio">{tieneOfertaVigente(producto) && <del>{formatearPesos(producto.precio)}</del>}{formatearPesos(precioVigente(producto))}</span>
                  </button>
                )
              })}
            </div>
          )}

          {items.length === 0 ? (
            <div className="f-pedidos-sin-items"><b>El pedido todavía está vacío</b><span className="f-dato">Buscá arriba para agregar artículos.</span></div>
          ) : (
            <ul className="f-pedidos-renglones">
              {items.map((item) => (
                <li key={item.productoId} className="f-pedidos-renglon">
                  <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{item.nombre}</span><span className="f-renglon-detalle">{formatearPesos(item.precio)} por unidad</span></span>
                  <span className="f-pedidos-cantidad">
                    <button type="button" className="f-icono-boton" aria-label={`Quitar una unidad de ${item.nombre}`} onClick={() => setItems((actuales) => cambiarCantidadPedido(actuales, item.productoId, item.cantidad - 1))}>−</button>
                    <b>{item.cantidad}</b>
                    <button type="button" className="f-icono-boton" aria-label={`Agregar una unidad de ${item.nombre}`} onClick={() => setItems((actuales) => cambiarCantidadPedido(actuales, item.productoId, item.cantidad + 1))}>+</button>
                  </span>
                  <b className="f-pedidos-subtotal">{formatearPesos(item.precio * item.cantidad)}</b>
                </li>
              ))}
            </ul>
          )}
          <div className="f-pedidos-form-total">
            <span className="f-dato">{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>
            <b className="f-plata-16">{formatearPesos(total)}</b>
          </div>
        </section>

        <section className="f-pedidos-paso" aria-labelledby="pedido-paso-entrega">
          <h3 id="pedido-paso-entrega" className="f-pedidos-paso-titulo"><span aria-hidden="true">3</span>Entrega y seguimiento</h3>
          <Segmentado
            etiqueta="Tipo de entrega"
            valor={tipoEntrega}
            onCambiar={setTipoEntrega}
            opciones={[
              { valor: 'retiro', texto: <><IconoEntrega /> Retiro</> },
              { valor: 'envio', texto: <><IconoUbicacion /> Envío</> },
            ]}
          />
          {tipoEntrega === 'envio' && (
            <label className="f-campo">
              <span>Dirección <em>obligatoria para envío</em></span>
              <input aria-label="Dirección de entrega" className="f-entrada" placeholder="Calle, número, barrio…" value={direccion} onChange={(evento) => setDireccion(evento.target.value)} />
            </label>
          )}
          <label className="f-campo">
            <span>Fecha de entrega <em>opcional</em></span>
            <input aria-label="Fecha de entrega" type="date" className="f-entrada" value={fechaEntrega} onChange={(evento) => setFechaEntrega(evento.target.value)} />
          </label>
          <label className="f-campo">
            <span>Nota interna <em>opcional</em></span>
            <textarea aria-label="Nota interna del pedido" className="f-entrada f-pedidos-textarea" rows={2} placeholder="Ej. llevar cambio, sin azúcar, timbre rojo…" value={nota} onChange={(evento) => setNota(evento.target.value)} />
          </label>
          <label className="f-pedidos-reserva-opcion">
            <input type="checkbox" checked={reservarStock} onChange={(evento) => setReservarStock(evento.target.checked)} />
            <span><b>Reservar stock</b><span className="f-dato">Bloquea las unidades para este pedido y evita venderlas dos veces.</span></span>
          </label>
        </section>

        {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
        <div className="f-pedidos-form-acciones">
          <Boton type="button" variante="secundario" onClick={onCancel}>Cancelar</Boton>
          <Boton type="submit" variante="principal" disabled={guardando}>{guardando ? 'Guardando pedido…' : pedido ? 'Guardar cambios' : 'Crear pedido'}</Boton>
        </div>
      </form>
    </Hoja>
  )
}

function pedidoCantidad(pedido: Pedido, productoId: string): number {
  return pedido.items.filter((item) => item.productoId === productoId).reduce((suma, item) => suma + item.cantidad, 0)
}

function pedidoReservaDelProducto(pedido: Pedido, productoId: string): boolean {
  return pedido.items.some((item) => item.productoId === productoId)
}
