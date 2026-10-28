'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, Venta } from '@/dominio/tipos'
import { deudaPorCliente } from '@/dominio/fiado'
import { normalizarTexto } from '@/dominio/validaciones'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { enlaceWhatsApp, mensajeCobro } from '@/dominio/mensajes'
import { db } from '@/datos/local/db'
import { ErrorClienteConHistorial, repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Importe } from '@/ui/sistema/Importe'
import { usePuede } from '@/ui/sistema/usoRol'
import { IconoAlerta, IconoClientes, IconoEditar, IconoEliminar, IconoFlechaDerecha, IconoFiados, IconoPedidos, IconoWhatsApp } from '@/ui/sistema/iconos'

type FiltroCliente = 'todos' | 'con_deuda' | 'activos' | 'favoritos'

interface PerfilCliente extends Cliente {
  gastado: number
  cantidadVentas: number
  ultimaCompra: number | null
  ticketPromedio: number
  unidades: number
  deuda: number
  diasDeuda: number
  favoritos: Array<{ nombre: string; unidades: number }>
}

function construirPerfiles(clientes: Cliente[], ventas: Venta[], fiados: Parameters<typeof deudaPorCliente>[0], pagos: Parameters<typeof deudaPorCliente>[1], ahora: number): PerfilCliente[] {
  const deudas = new Map(deudaPorCliente(fiados, pagos, ahora).map((deuda) => [deuda.clienteId, deuda]))
  return clientes.map((cliente) => {
    const compras = ventas.filter((venta) => venta.clienteId === cliente.id && venta.estado !== 'anulada')
    const ranking = new Map<string, number>()
    let unidades = 0
    for (const venta of compras) for (const item of venta.items) {
      ranking.set(item.nombre, (ranking.get(item.nombre) ?? 0) + item.cantidad)
      unidades += item.cantidad
    }
    const favoritos = [...ranking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre, cantidad]) => ({ nombre, unidades: cantidad }))
    const deuda = deudas.get(cliente.id)
    return {
      ...cliente,
      gastado: compras.reduce((total, venta) => total + venta.total, 0),
      cantidadVentas: compras.length,
      ultimaCompra: compras.sort((a, b) => b.fecha - a.fecha)[0]?.fecha ?? null,
      ticketPromedio: compras.length ? Math.round(compras.reduce((total, venta) => total + venta.total, 0) / compras.length) : 0,
      unidades,
      deuda: deuda?.saldo ?? 0,
      diasDeuda: deuda?.diasDelMasViejo ?? 0,
      favoritos,
    }
  }).sort((a, b) => b.gastado - a.gastado)
}

function fechaRelativa(epoch: number | null): string {
  if (!epoch) return 'Todavía no compró'
  const dias = Math.floor((Date.now() - epoch) / (24 * 60 * 60 * 1000))
  if (dias <= 0) return 'Compró hoy'
  if (dias === 1) return 'Compró ayer'
  if (dias < 30) return `Hace ${dias} días`
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(epoch))
}

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

export function PantallaClientes() {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroCliente>('todos')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<'nuevo' | Cliente | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null)
  const [eliminando, setEliminando] = useState(false)
  // El vendedor carga y edita clientes; borrarlos es del dueño.
  const borra = usePuede('borrarClientes')
  const [ahora] = useState(() => Date.now())
  const datos = useLiveQuery(async () => {
    const [clientes, ventas, fiados, pagos] = await Promise.all([db.clientes.toArray(), db.ventas.toArray(), db.fiados.toArray(), db.fiadoPagos.toArray()])
    const perfiles = construirPerfiles(clientes, ventas, fiados, pagos, ahora)
    return { perfiles, ventas }
  }, [ahora], { perfiles: [], ventas: [] })
  const aguja = normalizarTexto(busqueda)
  const visibles = useMemo(() => datos.perfiles.filter((cliente) => {
    if (filtro === 'con_deuda' && cliente.deuda <= 0) return false
    if (filtro === 'activos' && cliente.cantidadVentas === 0) return false
    if (filtro === 'favoritos' && cliente.gastado === 0) return false
    return !aguja || normalizarTexto(`${cliente.nombre} ${cliente.telefono ?? ''} ${cliente.favoritos.map((favorito) => favorito.nombre).join(' ')}`).includes(aguja)
  }), [aguja, datos.perfiles, filtro])
  const totalDeuda = datos.perfiles.reduce((total, cliente) => total + cliente.deuda, 0)
  const compradoresMes = datos.perfiles.filter((cliente) => cliente.ultimaCompra !== null && ahora - cliente.ultimaCompra < 30 * 24 * 60 * 60 * 1000).length
  const seleccionadoPerfil = datos.perfiles.find((cliente) => cliente.id === seleccionado)

  async function guardarCliente(cliente: Omit<Cliente, 'id'>, id?: string) {
    try {
      if (id) await repos.clientes.actualizar(id, cliente)
      else await repos.clientes.guardar(cliente)
      setFormulario(null)
      setAviso(id ? 'Cliente actualizado.' : 'Cliente agregado a tu cartera.')
    } catch {
      setAviso('No se pudo guardar el cliente.')
    }
  }

  function solicitarEliminacion(cliente: Cliente) {
    setAviso(null)
    setClienteAEliminar(cliente)
  }

  async function confirmarEliminacion() {
    const cliente = clienteAEliminar
    if (!cliente || eliminando) return
    setEliminando(true)

    try {
      const eliminado = await repos.clientes.eliminar(cliente.id)
      setClienteAEliminar(null)
      if (!eliminado) return
      setSeleccionado(null)
      setFormulario(null)
      setAviso('Cliente eliminado. El cambio se sincronizará con tus otros dispositivos.')
    } catch (error) {
      setClienteAEliminar(null)
      if (error instanceof ErrorClienteConHistorial) {
        setAviso(error.message)
        return
      }
      setAviso('No se pudo eliminar el cliente. Revisá la conexión e intentá de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="page-clientes px-5 pt-6">
      <div className="page-module-head clientes-head"><div><span className="page-kicker">Relación comercial</span><h1 className="page-title">Clientes</h1><p className="page-description">Conocé quién vuelve, quién debe y qué suele llevar.</p></div><Boton variante="principal" className="button-with-icon clientes-new-button" onClick={() => { setFormulario('nuevo'); setAviso(null) }}><IconoClientes /> Nuevo cliente</Boton></div>

      <section className="clientes-highlight"><div className="clientes-highlight-copy"><span className="clientes-highlight-icon"><IconoClientes /></span><div><strong>{datos.perfiles.length === 0 ? 'Construí tu cartera' : `${datos.perfiles.length} ${datos.perfiles.length === 1 ? 'cliente registrado' : 'clientes registrados'}`}</strong><p>{compradoresMes > 0 ? `${compradoresMes} compraron en los últimos 30 días.` : 'Cada compra vinculada te ayuda a vender mejor la próxima vez.'}</p></div></div><div className="clientes-highlight-debt"><span>Fiado abierto</span><strong>{formatearPesos(totalDeuda)}</strong></div></section>

      <div className="clientes-metrics"><div><span>Clientes</span><strong>{datos.perfiles.length}</strong><small>en tu cartera</small></div><div><span>Activos</span><strong>{compradoresMes}</strong><small>últimos 30 días</small></div><div><span>Ticket promedio</span><strong>{formatearPesos(datos.perfiles.length ? Math.round(datos.perfiles.reduce((total, cliente) => total + cliente.ticketPromedio, 0) / datos.perfiles.length) : 0)}</strong><small>por cliente</small></div><div><span>Mayor cliente</span><strong className="clientes-top-name">{datos.perfiles[0]?.nombre || '—'}</strong><small>{datos.perfiles[0] ? formatearPesos(datos.perfiles[0].gastado) : 'sin ventas aún'}</small></div></div>

      {formulario && <ClienteForm cliente={formulario === 'nuevo' ? undefined : formulario} onCancel={() => setFormulario(null)} onSave={(cliente, id) => void guardarCliente(cliente, id)} />}
      {aviso && <div className="clientes-notice" role="status"><span>{aviso}</span><button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button></div>}
      {borra && clienteAEliminar && <section className="cliente-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="cliente-delete-title"><span className="cliente-delete-confirmation-icon"><IconoEliminar /></span><div><strong id="cliente-delete-title">¿Eliminar a {clienteAEliminar.nombre}?</strong><p>Se quitará de tu cartera. Las ventas, fiados y pedidos históricos siempre se conservan.</p></div><div className="cliente-delete-confirmation-actions"><button type="button" className="cliente-delete-cancel" onClick={() => setClienteAEliminar(null)} disabled={eliminando}>Cancelar</button><button type="button" className="cliente-delete-confirm" onClick={() => void confirmarEliminacion()} disabled={eliminando}>{eliminando ? 'Eliminando…' : 'Sí, eliminar'}</button></div></section>}

      <label className="clientes-search"><IconoClientes /><input aria-label="Buscar clientes" placeholder="Buscar nombre, teléfono o producto favorito…" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} /></label>
      <div className="clientes-filter-scroll" data-scroll-x>{([['todos', 'Todos'], ['activos', 'Activos'], ['con_deuda', 'Con fiado'], ['favoritos', 'Con compras']] as Array<[FiltroCliente, string]>).map(([opcion, texto]) => <button type="button" key={opcion} className={filtro === opcion ? 'is-selected' : ''} onClick={() => setFiltro(opcion)}>{texto}</button>)}</div>

      {seleccionadoPerfil && <ClienteDetalle perfil={seleccionadoPerfil} ventas={datos.ventas} onCerrar={() => setSeleccionado(null)} onEditar={() => setFormulario(seleccionadoPerfil)} onEliminar={borra ? () => solicitarEliminacion(seleccionadoPerfil) : undefined} />}
      {visibles.length === 0 ? <section className="clientes-empty"><IconoClientes /><span className="page-kicker">Cartera lista</span><h2>{datos.perfiles.length === 0 ? 'Tus clientes van a vivir acá' : 'No encontramos clientes'}</h2><p>{datos.perfiles.length === 0 ? 'Guardá un nombre y teléfono para reconocer a quien vuelve y resolver sus pedidos más rápido.' : 'Probá con otra búsqueda o filtro.'}</p>{datos.perfiles.length === 0 && <Boton variante="principal" className="button-with-icon" onClick={() => setFormulario('nuevo')}><IconoClientes /> Agregar primer cliente</Boton>}</section> : <div className="clientes-grid">{visibles.map((cliente) => <article key={cliente.id} className={`cliente-card${seleccionado === cliente.id ? ' is-selected' : ''}`}><button type="button" className="cliente-card-main" onClick={() => setSeleccionado(seleccionado === cliente.id ? null : cliente.id)}><span className="cliente-avatar">{iniciales(cliente.nombre)}</span><span className="cliente-card-copy"><strong>{cliente.nombre}</strong><small>{cliente.telefono || 'Sin teléfono'} · {fechaRelativa(cliente.ultimaCompra)}</small><span className="cliente-favorite-products">{cliente.favoritos.length ? `Suele llevar ${cliente.favoritos.map((favorito) => favorito.nombre).join(', ')}` : 'Sin historial de compras'}</span></span><span className="cliente-card-total"><strong>{formatearPesos(cliente.gastado)}</strong><small>{cliente.cantidadVentas} {cliente.cantidadVentas === 1 ? 'compra' : 'compras'}</small></span></button><div className="cliente-card-bottom">{cliente.deuda > 0 ? <span className="cliente-debt"><IconoAlerta /> Debe {formatearPesos(cliente.deuda)}</span> : <span className="cliente-ok">Cuenta al día</span>}<div>{cliente.telefono && <a href={enlaceWhatsApp(cliente.telefono, cliente.deuda > 0 ? mensajeCobro(cliente, cliente.deuda, cliente.diasDeuda) : `Hola ${cliente.nombre}, ¿cómo estás?`)} target="_blank" rel="noreferrer" className="cliente-quick-link"><IconoWhatsApp /> WhatsApp</a>}<button type="button" className="cliente-quick-link" onClick={() => setFormulario(cliente)}><IconoEditar /> Editar</button>{borra && <button type="button" className="cliente-quick-link cliente-delete-link" aria-label={`Eliminar cliente ${cliente.nombre}`} onClick={() => solicitarEliminacion(cliente)}><IconoEliminar /> Eliminar</button>}</div></div></article>)}</div>}

      <div className="clientes-footer-actions"><Link href="/pedidos" className="clientes-footer-link"><IconoPedidos /><span><strong>Pedidos</strong><small>Usá esta cartera al tomar encargos.</small></span><IconoFlechaDerecha /></Link><Link href="/fiados" className="clientes-footer-link"><IconoFiados /><span><strong>Fiados</strong><small>Revisá vencimientos y registrá pagos.</small></span><IconoFlechaDerecha /></Link></div>
    </div>
  )
}

function ClienteDetalle({ perfil, ventas, onCerrar, onEditar, onEliminar }: { perfil: PerfilCliente; ventas: Venta[]; onCerrar: () => void; onEditar: () => void; onEliminar?: () => void }) {
  const compras = ventas.filter((venta) => venta.clienteId === perfil.id && venta.estado !== 'anulada').sort((a, b) => b.fecha - a.fecha).slice(0, 5)
  return <section className="cliente-detail"><div className="cliente-detail-head"><div><span className="page-kicker">Ficha del cliente</span><h2>{perfil.nombre}</h2><p>{perfil.telefono || 'Sin teléfono registrado'}</p></div><div className="cliente-detail-actions">{perfil.telefono && <a className="cliente-detail-whatsapp" href={enlaceWhatsApp(perfil.telefono, perfil.deuda > 0 ? mensajeCobro(perfil, perfil.deuda, perfil.diasDeuda) : `Hola ${perfil.nombre}, ¿cómo estás?`)} target="_blank" rel="noreferrer"><IconoWhatsApp /> Escribir</a>}<button type="button" onClick={onEditar}><IconoEditar /> Editar</button>{onEliminar && <button type="button" className="cliente-detail-delete" onClick={onEliminar}><IconoEliminar /> Eliminar</button>}<button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button></div></div><div className="cliente-detail-stats"><div><span>Total comprado</span><strong>{formatearPesos(perfil.gastado)}</strong></div><div><span>Compras</span><strong>{perfil.cantidadVentas}</strong></div><div><span>Ticket medio</span><strong>{formatearPesos(perfil.ticketPromedio)}</strong></div><div><span>Fiado</span><strong style={{ color: perfil.deuda > 0 ? 'var(--ambar)' : 'var(--verde)' }}>{formatearPesos(perfil.deuda)}</strong></div></div>{perfil.favoritos.length > 0 && <div className="cliente-detail-favorites"><span>Lo que más lleva</span><div>{perfil.favoritos.map((favorito) => <span key={favorito.nombre}>{favorito.nombre} <strong>×{favorito.unidades}</strong></span>)}</div></div>}<div className="cliente-detail-history"><h3>Últimas compras</h3>{compras.length === 0 ? <p>Todavía no hay ventas vinculadas.</p> : <ul>{compras.map((venta) => <li key={venta.id}><span>{new Date(venta.fecha).toLocaleDateString('es-AR')} · {venta.items.map((item) => item.nombre).join(', ')}</span><strong><Importe centavos={venta.total} tamaño="chico" /></strong></li>)}</ul>}</div></section>
}

function ClienteForm({ cliente, onCancel, onSave }: { cliente?: Cliente; onCancel: () => void; onSave: (cliente: Omit<Cliente, 'id'>, id?: string) => void }) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [limite, setLimite] = useState(cliente?.limiteFiado ? String(cliente.limiteFiado / 100) : '')
  const [aviso, setAviso] = useState<string | null>(null)
  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (nombre.trim().length < 2) { setAviso('Escribí un nombre de al menos 2 caracteres.'); return }
    const limiteCentavos = limite.trim() ? pesosACentavos(Number(limite.replace(',', '.')) || 0) : undefined
    if (limiteCentavos !== undefined && limiteCentavos < 0) { setAviso('El límite no puede ser negativo.'); return }
    onSave({ nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: limiteCentavos }, cliente?.id)
  }
  return <form className="form-shell form-card cliente-form" onSubmit={guardar}><div className="form-intro"><span className="form-intro-icon"><IconoClientes /></span><div><strong>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</strong><p>Guardá la información que te ayuda a vender y cobrar mejor.</p></div></div><label className="form-field"><span className="form-field-label">Nombre <em>obligatorio</em></span><input autoFocus aria-label="Nombre del cliente" className="form-input" placeholder="Ej. Marta González" value={nombre} onChange={(evento) => setNombre(evento.target.value)} /></label><label className="form-field"><span className="form-field-label">Teléfono <em>WhatsApp opcional</em></span><input aria-label="Teléfono del cliente" inputMode="tel" className="form-input" placeholder="261 555 1234" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} /></label><label className="form-field"><span className="form-field-label">Límite de fiado <em>opcional</em></span><div className="form-input-with-prefix"><span>$</span><input aria-label="Límite de fiado" inputMode="decimal" className="form-input tabular" placeholder="Ej. 20.000" value={limite} onChange={(evento) => setLimite(evento.target.value)} /></div><span className="form-field-help">Te avisamos antes de seguir fiando por encima de este monto.</span></label>{aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}<div className="form-actions"><Boton type="submit" variante="principal">{cliente ? 'Guardar cambios' : 'Guardar cliente'}</Boton><Boton type="button" variante="secundario" onClick={onCancel}>Cancelar</Boton></div></form>
}
