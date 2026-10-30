'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, Venta } from '@/dominio/tipos'
import { deudaPorCliente } from '@/dominio/fiado'
import { normalizarTexto } from '@/dominio/validaciones'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { enlaceWhatsApp, mensajeCobro } from '@/dominio/mensajes'
import { db } from '@/datos/local/db'
import { ErrorClienteConHistorial, repos } from '@/datos/local/repos'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { usePuede } from '@/ui/sistema/usoRol'
import { IconoCerrar, IconoClientes, IconoEditar, IconoEliminar, IconoFlechaDerecha, IconoFiados, IconoPedidos, IconoWhatsApp } from '@/ui/sistema/iconos'
import './clientes.css'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { TEXTOS, noSePudo } from '@/ui/sistema/textos'

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
  const conDeuda = datos.perfiles.filter((cliente) => cliente.deuda > 0).length
  const compradoresMes = datos.perfiles.filter((cliente) => cliente.ultimaCompra !== null && ahora - cliente.ultimaCompra < 30 * 24 * 60 * 60 * 1000).length
  const seleccionadoPerfil = datos.perfiles.find((cliente) => cliente.id === seleccionado)

  async function guardarCliente(cliente: Omit<Cliente, 'id'>, id?: string) {
    try {
      if (id) await repos.clientes.actualizar(id, cliente)
      else await repos.clientes.guardar(cliente)
      setFormulario(null)
      setAviso(id ? 'Cliente actualizado.' : 'Cliente agregado a tu cartera.')
    } catch {
      setAviso(noSePudo('guardar', 'el cliente'))
    }
  }

  function solicitarEliminacion(cliente: Cliente) {
    setAviso(null)
    setSeleccionado(null)
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
      setAviso(`Cliente eliminado. ${TEXTOS.avisoEliminado}`)
    } catch (error) {
      setClienteAEliminar(null)
      if (error instanceof ErrorClienteConHistorial) {
        setAviso(error.message)
        return
      }
      setAviso(noSePudo('eliminar', 'el cliente'))
    } finally {
      setEliminando(false)
    }
  }

  const mejor = datos.perfiles[0]
  // Redondeado a pesos: un promedio con centavos no le sirve a nadie en el mostrador.
  const ticketPromedio = datos.perfiles.length ? Math.round(datos.perfiles.reduce((total, cliente) => total + cliente.ticketPromedio, 0) / datos.perfiles.length / 100) * 100 : 0

  return (
    <div className="page-clientes f-cartera">
      <header className="f-clientes-cabeza">
        <div>
          <h1 className="f-titulo">Clientes</h1>
          <p className="f-clientes-sub">Quién vuelve, quién debe y qué suele llevar.</p>
        </div>
        <Boton variante="principal" onClick={() => { setFormulario('nuevo'); setAviso(null) }}>
          + {TEXTOS.agregarCliente}
        </Boton>
      </header>

      <div className="f-clientes-resumen">
        <div className="f-clientes-debe">
          <span className="f-clientes-debe-texto">
            <span className="f-clientes-debe-rotulo">Fiado abierto</span>
            <span className="f-dato">{conDeuda === 0 ? 'Nadie te debe' : `${conDeuda} ${conDeuda === 1 ? 'cliente debe' : 'clientes deben'}`}</span>
          </span>
          <b className="f-plata f-clientes-debe-monto">{formatearPesos(totalDeuda)}</b>
        </div>
        <Tarjeta relleno="normal" className="f-clientes-datos">
          <div><span className="f-dato">Clientes</span><b>{datos.perfiles.length}</b><span className="f-dato">en tu cartera</span></div>
          <div><span className="f-dato">Activos</span><b>{compradoresMes}</b><span className="f-dato">últimos 30 días</span></div>
          <div><span className="f-dato">Ticket promedio</span><b>{formatearPesos(ticketPromedio)}</b><span className="f-dato">por cliente</span></div>
          <div><span className="f-dato">Mayor cliente</span><b className="f-clientes-top">{mejor?.nombre || '—'}</b><span className="f-dato">{mejor ? formatearPesos(mejor.gastado) : 'sin ventas aún'}</span></div>
        </Tarjeta>
      </div>

      {aviso && (
        <div className="f-aviso f-clientes-aviso" role="status" data-tono="ambar">
          <span>{aviso}</span>
          <button type="button" className="f-icono-boton" onClick={() => setAviso(null)} aria-label="Cerrar aviso"><IconoCerrar /></button>
        </div>
      )}

      <div className="f-clientes-filtros">
        <CampoBusqueda etiqueta="Buscar clientes" placeholder="Buscar nombre, teléfono o producto favorito" valor={busqueda} onCambiar={setBusqueda} />
        <Chips etiqueta="Filtrar clientes">
          {([['todos', 'Todos'], ['activos', 'Activos'], ['con_deuda', 'Con fiado'], ['favoritos', 'Con compras']] as Array<[FiltroCliente, string]>).map(([opcion, texto]) => (
            <Chip key={opcion} activo={filtro === opcion} onClick={() => setFiltro(opcion)}>{texto}</Chip>
          ))}
        </Chips>
      </div>

      {visibles.length === 0 ? (
        datos.perfiles.length === 0 ? (
          <EstadoVacio
            icono={<IconoClientes />}
            titulo="Todavía no tenés clientes"
            texto="Guardá un nombre y un teléfono para reconocer a quien vuelve y resolver sus pedidos más rápido."
            accion={{ etiqueta: TEXTOS.agregarCliente, alTocar: () => setFormulario('nuevo') }}
          />
        ) : (
          <EstadoVacio titulo="No encontramos clientes" texto="Probá con otra búsqueda o filtro." />
        )
      ) : (
        <ul className="f-clientes-grilla">
          {visibles.map((cliente) => (
            <li key={cliente.id}>
              <Tarjeta como="article" relleno="ninguno" className="f-clientes-tarjeta">
                <button type="button" className="f-clientes-principal" aria-expanded={seleccionado === cliente.id} onClick={() => setSeleccionado(cliente.id)}>
                  <span className="f-clientes-avatar" data-debe={cliente.deuda > 0} aria-hidden="true">{iniciales(cliente.nombre)}</span>
                  <span className="f-renglon-cuerpo">
                    <span className="f-renglon-titulo">{cliente.nombre}</span>
                    <span className="f-renglon-detalle">{cliente.telefono || 'Sin teléfono'} · {fechaRelativa(cliente.ultimaCompra)}</span>
                    <span className="f-renglon-detalle f-clientes-favoritos">{cliente.favoritos.length ? `Suele llevar ${cliente.favoritos.map((favorito) => favorito.nombre).join(', ')}` : 'Sin historial de compras'}</span>
                  </span>
                  <span className="f-clientes-total">
                    <b>{formatearPesos(cliente.gastado)}</b>
                    <span className="f-dato">{cliente.cantidadVentas} {cliente.cantidadVentas === 1 ? 'compra' : 'compras'}</span>
                  </span>
                </button>
                <div className="f-clientes-pie">
                  {cliente.deuda > 0 ? <Etiqueta tono="coral" punto>Debe {formatearPesos(cliente.deuda)}</Etiqueta> : <Etiqueta tono="gris">Cuenta al día</Etiqueta>}
                  <div className="f-clientes-acciones">
                    {cliente.telefono && (
                      <a data-tamano="normal" href={enlaceWhatsApp(cliente.telefono, cliente.deuda > 0 ? mensajeCobro(cliente, cliente.deuda, cliente.diasDeuda) : `Hola ${cliente.nombre}, ¿cómo estás?`)} target="_blank" rel="noreferrer" className={clasesBoton('secundario')}><IconoWhatsApp /> WhatsApp</a>
                    )}
                    <Boton variante="secundario" onClick={() => setFormulario(cliente)}><IconoEditar /> Editar</Boton>
                    {borra && <button type="button" className="f-icono-boton f-clientes-borrar" aria-label={`Eliminar cliente ${cliente.nombre}`} title="Eliminar cliente" onClick={() => solicitarEliminacion(cliente)}><IconoEliminar /></button>}
                  </div>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      <div className="f-clientes-atajos">
        <Link href="/pedidos" className="f-clientes-atajo"><IconoPedidos /><span><b>Pedidos</b><span className="f-dato">Usá esta cartera al tomar encargos.</span></span><IconoFlechaDerecha /></Link>
        <Link href="/fiados" className="f-clientes-atajo"><IconoFiados /><span><b>Fiados</b><span className="f-dato">Revisá vencimientos y registrá pagos.</span></span><IconoFlechaDerecha /></Link>
      </div>

      {seleccionadoPerfil && <ClienteDetalle perfil={seleccionadoPerfil} ventas={datos.ventas} onCerrar={() => setSeleccionado(null)} onEditar={() => { setSeleccionado(null); setFormulario(seleccionadoPerfil) }} onEliminar={borra ? () => solicitarEliminacion(seleccionadoPerfil) : undefined} />}
      {formulario && <ClienteForm cliente={formulario === 'nuevo' ? undefined : formulario} onCancel={() => setFormulario(null)} onSave={(cliente, id) => void guardarCliente(cliente, id)} />}
      {borra && clienteAEliminar && (
        <Hoja abierta onCerrar={() => { if (!eliminando) setClienteAEliminar(null) }} titulo={`¿Eliminar a ${clienteAEliminar.nombre}?`} ancho="angosto">
          <p className="f-hoja-ayuda">Se quitará de tu cartera. Las ventas, fiados y pedidos históricos siempre se conservan.</p>
          <div className="f-clientes-confirmar">
            <Boton variante="secundario" onClick={() => setClienteAEliminar(null)} disabled={eliminando}>Cancelar</Boton>
            <Boton variante="cuidado" onClick={() => void confirmarEliminacion()} disabled={eliminando}>{eliminando ? 'Eliminando…' : 'Sí, eliminar'}</Boton>
          </div>
        </Hoja>
      )}
    </div>
  )
}

function ClienteDetalle({ perfil, ventas, onCerrar, onEditar, onEliminar }: { perfil: PerfilCliente; ventas: Venta[]; onCerrar: () => void; onEditar: () => void; onEliminar?: () => void }) {
  const compras = ventas.filter((venta) => venta.clienteId === perfil.id && venta.estado !== 'anulada').sort((a, b) => b.fecha - a.fecha).slice(0, 5)
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={perfil.nombre} etiquetaCerrar="Cerrar ficha">
      <p className="f-hoja-ayuda">{perfil.telefono || 'Sin teléfono registrado'}</p>
      <div className="f-clientes-ficha-datos">
        <div><span className="f-dato">Total comprado</span><b>{formatearPesos(perfil.gastado)}</b></div>
        <div><span className="f-dato">Compras</span><b>{perfil.cantidadVentas}</b></div>
        <div><span className="f-dato">Ticket medio</span><b>{formatearPesos(perfil.ticketPromedio)}</b></div>
        <div><span className="f-dato">Fiado</span><b data-tono={perfil.deuda > 0 ? 'coral' : undefined}>{formatearPesos(perfil.deuda)}</b></div>
      </div>
      {perfil.favoritos.length > 0 && (
        <div className="f-clientes-ficha-bloque">
          <h3 className="f-hoja-subtitulo">Lo que más lleva</h3>
          <div className="f-clientes-favs">{perfil.favoritos.map((favorito) => <Etiqueta key={favorito.nombre} tono="gris">{favorito.nombre} ×{favorito.unidades}</Etiqueta>)}</div>
        </div>
      )}
      <div className="f-clientes-ficha-bloque">
        <h3 className="f-hoja-subtitulo">Últimas compras</h3>
        {compras.length === 0 ? <EstadoVacio compacto titulo="Todavía no compró" texto="Cuando le vendas, sus compras aparecen acá." /> : (
          <ul className="f-clientes-compras">
            {compras.map((venta) => (
              <li key={venta.id} className="f-renglon">
                <span className="f-renglon-cuerpo">
                  <span className="f-renglon-titulo">{venta.items.map((item) => item.nombre).join(', ')}</span>
                  <span className="f-renglon-detalle">{new Date(venta.fecha).toLocaleDateString('es-AR')}</span>
                </span>
                <span className="f-renglon-fin">{formatearPesos(venta.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="f-clientes-ficha-acciones">
        {perfil.telefono && (
          <a data-tamano="normal" className={clasesBoton('secundario')} href={enlaceWhatsApp(perfil.telefono, perfil.deuda > 0 ? mensajeCobro(perfil, perfil.deuda, perfil.diasDeuda) : `Hola ${perfil.nombre}, ¿cómo estás?`)} target="_blank" rel="noreferrer"><IconoWhatsApp /> Escribir</a>
        )}
        <Boton variante="secundario" onClick={onEditar}><IconoEditar /> Editar</Boton>
        {onEliminar && <Boton variante="cuidado" onClick={onEliminar}><IconoEliminar /> Eliminar</Boton>}
      </div>
    </Hoja>
  )
}

function ClienteForm({ cliente, onCancel, onSave }: { cliente?: Cliente; onCancel: () => void; onSave: (cliente: Omit<Cliente, 'id'>, id?: string) => void }) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [limite, setLimite] = useState(cliente?.limiteFiado ? String(cliente.limiteFiado / 100) : '')
  const [aviso, setAviso] = useState<string | null>(null)
  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (nombre.trim().length < 2) { setAviso('Escribí un nombre de al menos 2 caracteres.'); return }
    const limiteCentavos = limite.trim() ? pesosACentavos(pesosDeTexto(limite)) : undefined
    if (limiteCentavos !== undefined && limiteCentavos < 0) { setAviso('El límite no puede ser negativo.'); return }
    onSave({ nombre: nombre.trim(), telefono: telefono.trim() || null, limiteFiado: limiteCentavos }, cliente?.id)
  }
  return (
    <Hoja abierta onCerrar={onCancel} titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} ancho="angosto">
      <form className="f-clientes-form" onSubmit={guardar}>
        <p className="f-hoja-ayuda">Guardá la información que te ayuda a vender y cobrar mejor.</p>
        <label className="f-campo">
          <span>Nombre <em>obligatorio</em></span>
          <input autoFocus aria-label="Nombre del cliente" className="f-entrada" placeholder="Ej. Marta González" value={nombre} onChange={(evento) => setNombre(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>Teléfono <em>WhatsApp opcional</em></span>
          <input aria-label="Teléfono del cliente" inputMode="tel" className="f-entrada" placeholder="261 555 1234" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>Límite de fiado <em>opcional</em></span>
          <span className="f-clientes-pesos">
            <span aria-hidden="true">$</span>
            <input aria-label="Límite de fiado" inputMode="decimal" className="f-entrada tabular" placeholder="Ej. 20.000" value={limite} onChange={(evento) => setLimite(evento.target.value)} />
          </span>
          <small className="f-dato">Te avisamos antes de seguir fiando por encima de este monto.</small>
        </label>
        {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
        <Boton type="submit" variante="principal" ancho>{cliente ? 'Guardar cambios' : 'Guardar cliente'}</Boton>
      </form>
    </Hoja>
  )
}
