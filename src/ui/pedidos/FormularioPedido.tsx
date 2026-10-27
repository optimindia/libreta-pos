'use client'

import { useMemo, useState } from 'react'
import type { Cliente, ItemPedido, Pedido, Producto, TipoEntrega } from '@/dominio/tipos'
import { agregarItemPedido, cambiarCantidadPedido, totalPedido } from '@/dominio/pedidos'
import { precioVigente, tieneOfertaVigente } from '@/dominio/ticket'
import { normalizarTexto } from '@/dominio/validaciones'
import { formatearPesos } from '@/dominio/dinero'
import { ErrorStockInsuficiente, repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Importe } from '@/ui/sistema/Importe'
import { IconoCalendario, IconoClientes, IconoEntrega, IconoNota, IconoPedidos, IconoUbicacion } from '@/ui/sistema/iconos'

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
      setAviso('No se pudo guardar el cliente.')
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
        setAviso('No se pudo guardar el pedido. Revisá los datos y probá de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form-shell form-card pedido-form" onSubmit={(evento) => void guardar(evento)}>
      <div className="form-intro pedido-form-intro">
        <span className="form-intro-icon" aria-hidden="true"><IconoPedidos /></span>
        <div><strong>{pedido ? 'Editar pedido' : 'Nuevo pedido'}</strong><p>Organizá lo que te encargaron y convertílo en venta cuando se retire.</p></div>
      </div>

      <section className="form-section">
        <div className="form-section-heading"><span className="form-step">1</span><div><h3>Cliente</h3><p>Dejá el pedido vinculado para encontrarlo en segundos.</p></div></div>
        {!nuevoCliente ? (
          <>
            <label className="form-field"><span className="form-field-label">Buscar cliente <em>opcional</em></span><input aria-label="Buscar cliente del pedido" className="form-input" placeholder="Nombre o teléfono…" value={busquedaCliente} onChange={(evento) => setBusquedaCliente(evento.target.value)} /></label>
            <div className="pedido-client-picker">
              <button type="button" className={`pedido-client-option${clienteId === '' ? ' is-selected' : ''}`} onClick={() => setClienteId('')}><span className="pedido-client-avatar">•</span><span><strong>Sin cliente</strong><small>Pedido mostrador</small></span></button>
              {clientesVisibles.map((cliente) => <button type="button" key={cliente.id} className={`pedido-client-option${clienteId === cliente.id ? ' is-selected' : ''}`} onClick={() => setClienteId(cliente.id)}><span className="pedido-client-avatar">{iniciales(cliente.nombre)}</span><span><strong>{cliente.nombre}</strong><small>{cliente.telefono || 'Sin teléfono'}</small></span><span className="pedido-client-check">{clienteId === cliente.id ? '✓' : ''}</span></button>)}
            </div>
            <Boton type="button" variante="secundario" className="button-with-icon pedido-inline-action" onClick={() => setNuevoCliente(true)}><IconoClientes /> Crear cliente rápido</Boton>
            {clienteElegido && <p className="form-field-help pedido-selected-help">Pedido asociado a {clienteElegido.nombre}.</p>}
          </>
        ) : (
          <div className="pedido-new-client-box">
            <div className="pedido-new-client-heading"><IconoClientes /><strong>Nuevo cliente</strong><button type="button" onClick={() => setNuevoCliente(false)}>Elegir existente</button></div>
            <label className="form-field"><span className="form-field-label">Nombre <em>obligatorio</em></span><input autoFocus aria-label="Nombre del nuevo cliente" className="form-input" placeholder="Ej. Marta González" value={nombreNuevo} onChange={(evento) => setNombreNuevo(evento.target.value)} /></label>
            <label className="form-field"><span className="form-field-label">WhatsApp <em>opcional</em></span><input aria-label="Teléfono del nuevo cliente" inputMode="tel" className="form-input" placeholder="261 555 1234" value={telefonoNuevo} onChange={(evento) => setTelefonoNuevo(evento.target.value)} /></label>
            <Boton type="button" variante="secundario" disabled={guardandoCliente} onClick={() => void crearClienteRapido()}>{guardandoCliente ? 'Guardando…' : 'Guardar y vincular'}</Boton>
          </div>
        )}
      </section>

      <section className="form-section">
        <div className="form-section-heading"><span className="form-step">2</span><div><h3>Productos</h3><p>Buscá, sumá cantidades y revisá el total antes de guardar.</p></div></div>
        <label className="form-field"><span className="form-field-label">Agregar producto</span><input aria-label="Buscar producto para pedido" className="form-input" placeholder="Nombre, código o categoría…" value={busquedaProducto} onChange={(evento) => setBusquedaProducto(evento.target.value)} /></label>
        {busquedaProducto.trim() !== '' && <div className="pedido-product-picker">{productosVisibles.length === 0 ? <p className="pedido-picker-empty">No encontramos ese producto.</p> : productosVisibles.map((producto) => { const disponible = Math.max(0, producto.stock - (reservadas.get(producto.id) ?? 0) + (pedido?.reservarStock && pedidoReservaDelProducto(pedido, producto.id) ? pedidoCantidad(pedido, producto.id) : 0)); return <button type="button" key={producto.id} className="pedido-product-option" disabled={disponible <= 0} onClick={() => { setItems((actuales) => agregarItemPedido(actuales, producto)); setBusquedaProducto(''); setAviso(null) }}><span className="pedido-product-option-copy"><strong>{producto.nombre}</strong><small>{disponible > 0 ? `${disponible} disponibles para reservar` : 'Sin unidades disponibles'}</small></span><span className="pedido-product-option-price">{tieneOfertaVigente(producto) && <del>{formatearPesos(producto.precio)}</del>}{formatearPesos(precioVigente(producto))}</span></button> })}</div>}

        {items.length === 0 ? <div className="pedido-items-empty"><IconoPedidos /><span>El pedido todavía está vacío</span><small>Buscá arriba para agregar artículos.</small></div> : <ul className="pedido-items-list">{items.map((item) => <li key={item.productoId} className="pedido-item-row"><div className="pedido-item-copy"><strong>{item.nombre}</strong><small><Importe centavos={item.precio} tamaño="chico" /> por unidad</small></div><div className="pedido-item-controls"><button type="button" aria-label={`Quitar una unidad de ${item.nombre}`} onClick={() => setItems((actuales) => cambiarCantidadPedido(actuales, item.productoId, item.cantidad - 1))}>−</button><span>{item.cantidad}</span><button type="button" aria-label={`Agregar una unidad de ${item.nombre}`} onClick={() => setItems((actuales) => cambiarCantidadPedido(actuales, item.productoId, item.cantidad + 1))}>+</button></div><Importe centavos={item.precio * item.cantidad} tamaño="chico" /></li>)}</ul>}
        <div className="pedido-total-row"><span>{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span><strong><Importe centavos={total} tamaño="normal" /></strong></div>
      </section>

      <section className="form-section">
        <div className="form-section-heading"><span className="form-step">3</span><div><h3>Entrega y seguimiento</h3><p>Dejá todo claro para vos y para quien prepara el pedido.</p></div></div>
        <div className="pedido-delivery-grid"><button type="button" className={`pedido-delivery-choice${tipoEntrega === 'retiro' ? ' is-selected' : ''}`} onClick={() => setTipoEntrega('retiro')}><IconoEntrega /><span><strong>Retiro</strong><small>En el local</small></span></button><button type="button" className={`pedido-delivery-choice${tipoEntrega === 'envio' ? ' is-selected' : ''}`} onClick={() => setTipoEntrega('envio')}><IconoUbicacion /><span><strong>Envío</strong><small>A domicilio</small></span></button></div>
        {tipoEntrega === 'envio' && <label className="form-field"><span className="form-field-label">Dirección <em>obligatoria para envío</em></span><input aria-label="Dirección de entrega" className="form-input" placeholder="Calle, número, barrio…" value={direccion} onChange={(evento) => setDireccion(evento.target.value)} /></label>}
        <label className="form-field"><span className="form-field-label">Fecha de entrega <em>opcional</em></span><div className="pedido-input-with-icon"><IconoCalendario /><input aria-label="Fecha de entrega" type="date" className="form-input" value={fechaEntrega} onChange={(evento) => setFechaEntrega(evento.target.value)} /></div></label>
        <label className="form-field"><span className="form-field-label">Nota interna <em>opcional</em></span><div className="pedido-input-with-icon pedido-textarea-wrap"><IconoNota /><textarea aria-label="Nota interna del pedido" className="form-input" rows={2} placeholder="Ej. llevar cambio, sin azúcar, timbre rojo…" value={nota} onChange={(evento) => setNota(evento.target.value)} /></div></label>
        <label className="pedido-reservation-toggle"><input type="checkbox" checked={reservarStock} onChange={(evento) => setReservarStock(evento.target.checked)} /><span><strong>Reservar stock</strong><small>Bloquea las unidades para este pedido y evita venderlas dos veces.</small></span></label>
      </section>

      {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
      <div className="form-actions pedido-form-actions"><Boton type="submit" variante="principal" disabled={guardando}>{guardando ? 'Guardando pedido…' : pedido ? 'Guardar cambios' : 'Crear pedido'}</Boton><Boton type="button" variante="secundario" onClick={onCancel}>Cancelar</Boton></div>
    </form>
  )
}

function pedidoCantidad(pedido: Pedido, productoId: string): number {
  return pedido.items.filter((item) => item.productoId === productoId).reduce((suma, item) => suma + item.cantidad, 0)
}

function pedidoReservaDelProducto(pedido: Pedido, productoId: string): boolean {
  return pedido.items.some((item) => item.productoId === productoId)
}
