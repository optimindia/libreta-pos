'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Producto } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { normalizarTexto } from '@/dominio/validaciones'
import { valorStock } from '@/dominio/reportes'
import { alertasProducto, margenProducto, rotacionStock } from '@/dominio/inteligencia'
import { ErrorProductoConHistorial, ErrorStockInsuficiente, repos } from '@/datos/local/repos'
import { IconoAlerta, IconoConfirmar, IconoCerrar, IconoEditar, IconoEliminar, IconoFavorito, IconoMovimiento, IconoStock } from '@/ui/sistema/iconos'
import { FormularioProducto } from './FormularioProducto'

type Orden = 'nombre' | 'stock' | 'precio' | 'margen'

function nivel(producto: Producto): number {
  if (producto.stockMinimo <= 0) return 1
  return Math.max(0, Math.min(producto.stock / (producto.stockMinimo * 2), 1))
}

function colorNivel(producto: Producto): string {
  if (producto.stock <= 0) return 'var(--ambar)'
  if (producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo) return 'var(--ambar)'
  return 'var(--verde)'
}

function AjustarStock({ producto, onTerminado }: { producto: Producto; onTerminado: () => void }) {
  const [cantidad, setCantidad] = useState('1')
  const [modo, setModo] = useState<'sumar' | 'restar'>('sumar')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function guardar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    const numero = Number(cantidad)
    if (!Number.isInteger(numero) || numero <= 0) {
      setAviso('Escribí una cantidad entera mayor a cero.')
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      await repos.productos.ajustarStock(producto.id, modo === 'sumar' ? numero : -numero)
      onTerminado()
    } catch (error) {
      if (error instanceof ErrorStockInsuficiente) {
        setAviso(`No podés restar ${numero}: quedan ${error.disponible} unidades.`)
      } else {
        setAviso('No se pudo actualizar el stock. Probá de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="stock-adjust-form" onSubmit={(evento) => void guardar(evento)}>
      <div className="stock-adjust-heading"><strong>Ajustar existencias</strong><span>Ahora: {producto.stock} unidades</span></div>
      <div className="stock-adjust-controls">
        <label className="form-field stock-adjust-mode">
          <span className="form-field-label">Acción</span>
          <select aria-label={`Tipo de ajuste para ${producto.nombre}`} className="form-input" value={modo} onChange={(evento) => setModo(evento.target.value as 'sumar' | 'restar')}>
            <option value="sumar">Sumar</option>
            <option value="restar">Restar</option>
          </select>
        </label>
        <label className="form-field stock-adjust-quantity">
          <span className="form-field-label">Cantidad</span>
          <input aria-label={`Cantidad a ajustar de ${producto.nombre}`} inputMode="numeric" placeholder="Ej. 2" className="form-input tabular" value={cantidad} onChange={(evento) => setCantidad(evento.target.value)} />
        </label>
        <button type="submit" className="stock-adjust-submit" disabled={guardando}>{guardando ? '…' : 'Listo'}</button>
      </div>
      <p className="form-field-help">{modo === 'sumar' ? 'Usá Sumar cuando recibís mercadería.' : 'Usá Restar para corregir una pérdida o rotura.'}</p>
      {aviso && <p className="stock-adjust-warning" role="alert">{aviso}</p>}
    </form>
  )
}

function DetalleProducto({ producto, onCerrar }: { producto: Producto; onCerrar: () => void }) {
  const datos = useLiveQuery(async () => {
    const [ventas, ingresos] = await Promise.all([repos.ventas.todas(), repos.ingresos.todos()])
    const ventasProducto = ventas.filter((venta) => venta.estado !== 'anulada' && venta.items.some((item) => item.productoId === producto.id))
    const ingresosProducto = ingresos.filter((ingreso) => ingreso.items.some((item) => item.productoId === producto.id))
    const movimientos = [
      ...ventasProducto.map((venta) => ({ id: `venta-${venta.id}`, fecha: venta.fecha, texto: 'Venta', cantidad: -venta.items.filter((item) => item.productoId === producto.id).reduce((total, item) => total + item.cantidad, 0) })),
      ...ingresosProducto.map((ingreso) => ({ id: `ingreso-${ingreso.id}`, fecha: ingreso.fecha, texto: 'Ingreso', cantidad: ingreso.items.filter((item) => item.productoId === producto.id).reduce((total, item) => total + item.cantidad, 0) })),
    ].sort((a, b) => b.fecha - a.fecha).slice(0, 8)
    return { ventas, movimientos, rotacion: rotacionStock(producto, ventas), alertas: alertasProducto(producto) }
  }, [producto])
  if (!datos) return null
  return (
    <div className="mt-3 rounded-2xl px-3.5 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
      <div className="flex items-baseline justify-between"><div><h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Rendimiento</h3><div className="mt-1 text-[14px] font-semibold">{producto.nombre}</div></div><button type="button" className="text-[12px]" style={{ color: 'var(--tenue)' }} onClick={onCerrar}>Cerrar</button></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-xl px-1 py-2" style={{ background: 'var(--hueso-2)' }}><div className="text-[12px]" style={{ color: 'var(--tenue)' }}>Margen</div><div className="mt-0.5 text-[14px] font-bold">{margenProducto(producto)}%</div></div><div className="rounded-xl px-1 py-2" style={{ background: 'var(--hueso-2)' }}><div className="text-[12px]" style={{ color: 'var(--tenue)' }}>Vendidas</div><div className="mt-0.5 text-[14px] font-bold">{datos.rotacion.unidadesVendidas}</div></div><div className="rounded-xl px-1 py-2" style={{ background: 'var(--hueso-2)' }}><div className="text-[12px]" style={{ color: 'var(--tenue)' }}>Cobertura</div><div className="mt-0.5 text-[14px] font-bold">{datos.rotacion.diasCobertura === null ? '—' : `${datos.rotacion.diasCobertura}d`}</div></div></div>
      {datos.alertas.length > 0 && <p className="mt-2 text-[12px]" style={{ color: 'var(--ambar)' }}>{datos.alertas.join(' · ')}</p>}
      <h4 className="mt-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Últimos movimientos</h4>
      {datos.movimientos.length === 0 ? <p className="mt-2 text-[12px]" style={{ color: 'var(--tenue)' }}>Todavía no hay ventas ni ingresos para este producto.</p> : <ul className="mt-1">{datos.movimientos.map((movimiento) => <li key={movimiento.id} className="flex justify-between py-1.5 text-[12px]" style={{ borderTop: '1px solid var(--linea)' }}><span>{movimiento.texto} · {new Date(movimiento.fecha).toLocaleDateString('es-AR')}</span><span className="tabular" style={{ color: movimiento.cantidad > 0 ? 'var(--verde)' : 'var(--ambar)' }}>{movimiento.cantidad > 0 ? '+' : ''}{movimiento.cantidad}</span></li>)}</ul>}
    </div>
  )
}

/** Catálogo operativo: buscar, filtrar, ordenar, editar y corregir stock sin
 * abandonar la pantalla. */
export function CatalogoStock({ productos, onCargar }: { productos: Producto[]; onCargar?: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [soloFaltantes, setSoloFaltantes] = useState(false)
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [ajustando, setAjustando] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null)
  const [borrandoProducto, setBorrandoProducto] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const inventario = valorStock(productos)
  const categorias = useMemo(() => [...new Set(productos.map((producto) => producto.categoria).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, 'es')), [productos])

  const visibles = useMemo(() => {
    const aguja = normalizarTexto(busqueda)
    return productos
      .filter((producto) => {
        const coincide = aguja === '' || normalizarTexto(`${producto.nombre} ${producto.codigoBarras ?? ''}`).includes(aguja)
        const falta = producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo
        const tieneAlerta = alertasProducto(producto).length > 0
        return coincide && (!soloFaltantes || falta) && (!soloAlertas || tieneAlerta) && (categoria === '' || producto.categoria === categoria)
      })
      .sort((a, b) => {
        if (orden === 'stock') return a.stock - b.stock
        if (orden === 'precio') return b.precio - a.precio
        if (orden === 'margen') return margenProducto(b) - margenProducto(a)
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [busqueda, categoria, orden, productos, soloAlertas, soloFaltantes])

  useEffect(() => {
    if (!editando && !productoAEliminar) return
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || borrandoProducto) return
      setEditando(null)
      setProductoAEliminar(null)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [borrandoProducto, editando, productoAEliminar])

  function solicitarEliminacion(producto: Producto) {
    setAviso(null)
    setEditando(null)
    setAjustando(null)
    setDetalle(null)
    setProductoAEliminar(producto)
  }

  async function confirmarEliminacion() {
    if (!productoAEliminar) return
    const producto = productoAEliminar
    setBorrandoProducto(true)
    setAviso(null)
    try {
      const eliminado = await repos.productos.eliminar(producto.id)
      setProductoAEliminar(null)
      if (!eliminado) return
      setAviso({ tipo: 'exito', texto: `${producto.nombre} fue eliminado. El cambio se sincronizará con tus otros dispositivos.` })
    } catch (error) {
      setProductoAEliminar(null)
      if (error instanceof ErrorProductoConHistorial) {
        setAviso({ tipo: 'error', texto: error.message })
      } else {
        setAviso({ tipo: 'error', texto: 'No se pudo eliminar el producto. Revisá la conexión e intentá de nuevo.' })
      }
    } finally {
      setBorrandoProducto(false)
    }
  }

  const avisoVisual = aviso && (
    <div className={`stock-action-notice is-${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
      <span className="stock-action-notice-icon" aria-hidden="true">{aviso.tipo === 'error' ? <IconoAlerta /> : <IconoConfirmar />}</span>
      <span>{aviso.texto}</span>
      <button type="button" className="stock-action-notice-close" aria-label="Cerrar aviso" onClick={() => setAviso(null)}><IconoCerrar /></button>
    </div>
  )

  if (productos.length === 0) {
    return (
      <>
        {avisoVisual}
        <section className="stock-empty-state" aria-labelledby="stock-empty-title">
          <span className="stock-empty-icon" aria-hidden="true"><IconoStock /></span>
          <span className="stock-empty-kicker">Catálogo listo</span>
          <h2 id="stock-empty-title">Empezá con tu primer producto</h2>
          <p>Cargá precio y existencias para tener el stock bajo control desde la primera venta.</p>
          {onCargar && <Boton variante="principal" className="stock-empty-action" onClick={onCargar}>Cargar primer producto</Boton>}
        </section>
      </>
    )
  }

  return (
    <div className="mt-3">
      {avisoVisual}
      <div className="rounded-2xl px-3.5 py-3" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Valor del inventario</span>
          <span className="tabular text-[12px]" style={{ color: 'var(--tenue)' }}>{inventario.unidades} unidades</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <Importe centavos={inventario.costo} tamaño="normal" />
          <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>a costo · <Importe centavos={inventario.venta} tamaño="chico" /></span>
        </div>
      </div>

      <input
        aria-label="Buscar en stock"
        placeholder="Buscar por nombre o código…"
        className="mt-3 w-full rounded-xl px-3 py-2.5 text-[14px]"
        style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }}
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
      />
      <div className="nb-filtros-stock mt-2">
        <Boton
          variante={soloFaltantes ? 'fiado' : 'secundario'}
          className="flex-1 !py-2.5 !text-[12px]"
          aria-pressed={soloFaltantes}
          onClick={() => setSoloFaltantes((actual) => !actual)}
        >
          Sólo faltantes
        </Boton>
        <Boton
          variante={soloAlertas ? 'fiado' : 'secundario'}
          className="flex-1 !py-2.5 !text-[12px]"
          aria-pressed={soloAlertas}
          onClick={() => setSoloAlertas((actual) => !actual)}
        >
          Calidad
        </Boton>
        <select
          aria-label="Ordenar stock"
          className="min-w-0 flex-1 rounded-2xl px-3 text-[12px] font-semibold"
          style={{ background: 'var(--hueso-2)', border: '2px solid var(--contorno)', color: 'var(--tinta)' }}
          value={orden}
          onChange={(evento) => setOrden(evento.target.value as Orden)}
        >
          <option value="nombre">Orden: nombre</option>
          <option value="stock">Orden: menos stock</option>
          <option value="precio">Orden: mayor precio</option>
          <option value="margen">Orden: mayor margen</option>
        </select>
      </div>
      {(categorias.length > 0) && <select aria-label="Filtrar por categoría" className="mt-2 w-full rounded-2xl px-3 py-2.5 text-[12px] font-semibold" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }} value={categoria} onChange={(evento) => setCategoria(evento.target.value)}><option value="">Todas las categorías</option>{categorias.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}</select>}

      {detalle && <DetalleProducto producto={detalle} onCerrar={() => setDetalle(null)} />}

      {visibles.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: 'var(--tenue)' }}>No encontramos productos con esos filtros.</p>
      ) : (
        <ul className="stock-grid nb-grilla-productos mt-3">
          {visibles.map((producto) => (
            <li key={producto.id} className="stock-producto nb-producto-stock">
              <div className="nb-producto-cabeza">
                <div className="nb-producto-nombre">{producto.nombre}</div>
                <button type="button" aria-label={producto.favorito ? 'Quitar favorito' : 'Agregar favorito'} title={producto.nombre} className="product-favorite-button nb-icono-boton" data-active={producto.favorito ? 'true' : 'false'} onClick={() => void repos.productos.marcarFavorito(producto.id, !producto.favorito)}><IconoFavorito /></button>
              </div>
              {producto.categoria && <div className="nb-producto-categoria">{producto.categoria}</div>}
              <Importe centavos={producto.precio} className="nb-producto-precio" />
              <div className="nb-producto-nivel" aria-hidden="true">
                <div style={{ width: `${nivel(producto) * 100}%`, background: colorNivel(producto) }} />
              </div>
              <div className="nb-producto-datos">
                <span className="tabular" style={{ color: colorNivel(producto) }}>{producto.stock <= 0 ? 'Sin stock' : `Quedan ${producto.stock}`}</span>
                <span style={{ color: producto.precio < producto.costo ? 'var(--ambar)' : 'var(--tenue)' }}>{margenProducto(producto)}% margen</span>
              </div>
              <div className="stock-product-actions nb-producto-acciones">
                <button
                  type="button"
                  className="stock-product-action"
                  aria-label={`Editar ${producto.nombre}`}
                  onClick={() => setEditando(producto)}
                >
                  <IconoEditar /> <span>Editar</span>
                </button>
                <button
                  type="button"
                  className="stock-product-action is-stock"
                  aria-label={`Ajustar stock de ${producto.nombre}`}
                  onClick={() => setAjustando(ajustando === producto.id ? null : producto.id)}
                >
                  <IconoMovimiento /> <span>Ajustar</span>
                </button>
              </div>
              <div className="nb-producto-pie">
                <button type="button" className="nb-accion-sec" aria-label={`Ver rendimiento de ${producto.nombre}`} onClick={() => setDetalle(producto)}>Rendimiento</button>
                <button type="button" className="nb-icono-boton nb-eliminar" aria-label={`Eliminar ${producto.nombre}`} title="Eliminar producto" onClick={() => solicitarEliminacion(producto)}><IconoEliminar /></button>
              </div>
              {ajustando === producto.id && (
                <AjustarStock producto={producto} onTerminado={() => setAjustando(null)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <div className="stock-modal-backdrop" role="presentation" onMouseDown={(evento) => { if (evento.currentTarget === evento.target) setEditando(null) }}>
          <section className="stock-modal stock-edit-modal" role="dialog" aria-modal="true" aria-labelledby="stock-edit-title" onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="stock-modal-head">
              <div className="stock-modal-title-wrap"><span className="stock-modal-icon" aria-hidden="true"><IconoEditar /></span><div><span className="page-kicker">Editar catálogo</span><h2 id="stock-edit-title">Editar {editando.nombre}</h2><p>Actualizá la ficha sin salir de tu inventario.</p></div></div>
              <button type="button" className="stock-modal-close" aria-label="Cerrar edición" onClick={() => setEditando(null)}><IconoCerrar /></button>
            </div>
            <FormularioProducto key={editando.id} producto={editando} onGuardado={() => setEditando(null)} onCancel={() => setEditando(null)} />
          </section>
        </div>
      )}

      {productoAEliminar && (
        <div className="stock-modal-backdrop" role="presentation" onMouseDown={(evento) => { if (evento.currentTarget === evento.target && !borrandoProducto) setProductoAEliminar(null) }}>
          <section className="stock-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="stock-delete-title" onMouseDown={(evento) => evento.stopPropagation()}>
            <span className="stock-delete-icon" aria-hidden="true"><IconoEliminar /></span>
            <div><span className="page-kicker">Eliminar del catálogo</span><h2 id="stock-delete-title">¿Eliminar {productoAEliminar.nombre}?</h2><p>Se quitará del catálogo y de las próximas ventas. Si ya tiene ventas, ingresos o pedidos, lo vamos a conservar para no romper tu historial.</p></div>
            <div className="stock-delete-actions"><button type="button" className="stock-delete-cancel" onClick={() => setProductoAEliminar(null)} disabled={borrandoProducto}>Cancelar</button><button type="button" className="stock-delete-confirm" onClick={() => void confirmarEliminacion()} disabled={borrandoProducto}>{borrandoProducto ? 'Eliminando…' : 'Sí, eliminar'}</button></div>
          </section>
        </div>
      )}
    </div>
  )
}
