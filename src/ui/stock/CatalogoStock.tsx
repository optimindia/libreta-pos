'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Producto } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { precioVigente } from '@/dominio/ticket'
import { Boton } from '@/ui/sistema/Boton'
import { Chip } from '@/ui/sistema/Chip'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { normalizarTexto } from '@/dominio/validaciones'
import { alertasProducto, margenProducto, rotacionStock } from '@/dominio/inteligencia'
import { ErrorProductoConHistorial, ErrorStockInsuficiente, repos } from '@/datos/local/repos'
import { IconoAlerta, IconoCerrar, IconoEliminar, IconoFavorito, IconoMovimiento, IconoPlata, IconoStock } from '@/ui/sistema/iconos'
import { FormularioProducto } from './FormularioProducto'
import { usePuede } from '@/ui/sistema/usoRol'
import './stock.css'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { TEXTOS, noSePudo } from '@/ui/sistema/textos'

type Orden = 'nombre' | 'stock' | 'precio' | 'margen'
type Filtro = 'reponer' | 'sin-stock' | 'sin-precio'

function enMinimo(producto: Producto): boolean {
  return producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo
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
        setAviso(noSePudo('actualizar', 'el stock'))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="f-stock-form" onSubmit={(evento) => void guardar(evento)}>
      <p className="f-hoja-ayuda">Ahora hay <b>{producto.stock} unidades</b>. {modo === 'sumar' ? 'Usá Sumar cuando recibís mercadería.' : 'Usá Restar para corregir una pérdida o rotura.'}</p>
      <div className="f-stock-fila-campos">
        <label className="f-campo">
          <span>Acción</span>
          <select aria-label={`Tipo de ajuste para ${producto.nombre}`} className="f-entrada" value={modo} onChange={(evento) => setModo(evento.target.value as 'sumar' | 'restar')}>
            <option value="sumar">Sumar</option>
            <option value="restar">Restar</option>
          </select>
        </label>
        <label className="f-campo">
          <span>Cantidad</span>
          <input aria-label={`Cantidad a ajustar de ${producto.nombre}`} inputMode="numeric" placeholder="Ej. 2" className="f-entrada" value={cantidad} onChange={(evento) => setCantidad(evento.target.value)} />
        </label>
      </div>
      {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
      <Boton type="submit" variante="principal" ancho disabled={guardando}>{guardando ? '…' : 'Listo'}</Boton>
    </form>
  )
}

function DetalleProducto({ producto }: { producto: Producto }) {
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
  if (!datos) return <EstadoCarga compacto filas={2} texto="Cargando el detalle…" />
  return (
    <>
      <div className="f-stock-datos">
        <div><span className="f-dato">Margen</span><strong className="f-plata">{margenProducto(producto)}%</strong></div>
        <div><span className="f-dato">Vendidas</span><strong className="f-plata">{datos.rotacion.unidadesVendidas}</strong></div>
        <div><span className="f-dato">Cobertura</span><strong className="f-plata">{datos.rotacion.diasCobertura === null ? '—' : `${datos.rotacion.diasCobertura}d`}</strong></div>
      </div>
      {datos.alertas.length > 0 && <p className="f-aviso" data-tono="ambar">{datos.alertas.join(' · ')}</p>}
      <h3 className="f-hoja-subtitulo">Últimos movimientos</h3>
      {datos.movimientos.length === 0 ? <EstadoVacio compacto titulo="Todavía no hay movimientos" texto="Las ventas y los ingresos de este producto aparecen acá." /> : (
        <ul className="f-stock-movimientos">
          {datos.movimientos.map((movimiento) => (
            <li key={movimiento.id} className="f-renglon">
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{movimiento.texto}</span><span className="f-renglon-detalle">{new Date(movimiento.fecha).toLocaleDateString('es-AR')}</span></span>
              <span className="f-renglon-fin f-stock-mov" data-entra={movimiento.cantidad > 0 ? 'true' : 'false'}>{movimiento.cantidad > 0 ? '+' : ''}{movimiento.cantidad}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const FILTROS: { id: Filtro; titulo: string; detalle: string; tono: 'ambar' | 'gris' | 'blanco' }[] = [
  { id: 'reponer', titulo: 'Para reponer', detalle: 'en el mínimo o menos', tono: 'ambar' },
  { id: 'sin-stock', titulo: 'Sin stock', detalle: 'no se pueden vender', tono: 'gris' },
  { id: 'sin-precio', titulo: 'Sin precio', detalle: 'se piden al vender', tono: 'blanco' },
]

function cumple(producto: Producto, filtro: Filtro): boolean {
  if (filtro === 'reponer') return enMinimo(producto)
  if (filtro === 'sin-stock') return producto.stock <= 0
  return precioVigente(producto) <= 0
}

/** Catálogo operativo: buscar, filtrar, ordenar, editar y corregir stock sin
 * abandonar la pantalla. En el celu cada producto es una tarjeta; en la PC,
 * un renglón de tabla. */
export function CatalogoStock({ productos, onCargar }: { productos: Producto[]; onCargar?: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [ajustando, setAjustando] = useState<Producto | null>(null)
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null)
  const [borrandoProducto, setBorrandoProducto] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const cancelarBorrado = useRef<HTMLButtonElement>(null)
  // Editar la ficha, ajustar o borrar es del dueño (la base se lo rechaza al
  // vendedor). Costos y márgenes tampoco se le muestran: son números del dueño.
  const editaCatalogo = usePuede('editarProductos')
  const ajustaStock = usePuede('ajustarStock')
  const categorias = useMemo(() => [...new Set(productos.map((producto) => producto.categoria).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, 'es')), [productos])
  const cuentas = useMemo(() => Object.fromEntries(FILTROS.map(({ id }) => [id, productos.filter((producto) => cumple(producto, id)).length])) as Record<Filtro, number>, [productos])

  const visibles = useMemo(() => {
    const aguja = normalizarTexto(busqueda)
    return productos
      .filter((producto) => {
        const coincide = aguja === '' || normalizarTexto(`${producto.nombre} ${producto.codigoBarras ?? ''}`).includes(aguja)
        const tieneAlerta = alertasProducto(producto).length > 0
        return coincide && (filtro === null || cumple(producto, filtro)) && (!soloAlertas || tieneAlerta) && (categoria === '' || producto.categoria === categoria)
      })
      .sort((a, b) => {
        if (orden === 'stock') return a.stock - b.stock
        if (orden === 'precio') return b.precio - a.precio
        if (orden === 'margen') return margenProducto(b) - margenProducto(a)
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [busqueda, categoria, orden, productos, soloAlertas, filtro])

  useEffect(() => {
    if (!productoAEliminar) return
    cancelarBorrado.current?.focus()
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || borrandoProducto) return
      setProductoAEliminar(null)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [borrandoProducto, productoAEliminar])

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
      setAviso({ tipo: 'exito', texto: `${producto.nombre} fue eliminado. ${TEXTOS.avisoEliminado}` })
    } catch (error) {
      setProductoAEliminar(null)
      if (error instanceof ErrorProductoConHistorial) {
        setAviso({ tipo: 'error', texto: error.message })
      } else {
        setAviso({ tipo: 'error', texto: noSePudo('eliminar', 'el producto') })
      }
    } finally {
      setBorrandoProducto(false)
    }
  }

  const avisoVisual = aviso && (
    <div className={aviso.tipo === 'exito' ? 'f-aviso f-stock-ok f-stock-aviso' : 'f-aviso f-stock-aviso'} data-tono={aviso.tipo === 'error' ? 'ambar' : undefined} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
      <span>{aviso.texto}</span>
      <button type="button" className="f-icono-boton" aria-label="Cerrar aviso" onClick={() => setAviso(null)}><IconoCerrar /></button>
    </div>
  )

  if (productos.length === 0) {
    return (
      <>
        {avisoVisual}
        <EstadoVacio
          icono={<IconoStock />}
          titulo="Todavía no tenés productos"
          texto="Cargá el precio y cuántos tenés para controlar el stock desde la primera venta."
          accion={onCargar ? { etiqueta: TEXTOS.cargarProducto, alTocar: onCargar } : undefined}
        />
      </>
    )
  }

  return (
    <div className="f-stock-catalogo">
      {avisoVisual}

      <div className="f-stock-resumen" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((opcion) => (
          <button key={opcion.id} type="button" className="f-stock-ficha" data-tono={opcion.tono} aria-pressed={filtro === opcion.id} onClick={() => setFiltro((actual) => (actual === opcion.id ? null : opcion.id))}>
            <span className="f-stock-ficha-texto"><b>{opcion.titulo}</b><span>{opcion.detalle}</span></span>
            <strong className="f-plata">{cuentas[opcion.id]}</strong>
          </button>
        ))}
      </div>

      <div className="f-stock-busqueda">
        <CampoBusqueda etiqueta="Buscar en stock" placeholder="Buscar por nombre o código" valor={busqueda} onCambiar={setBusqueda} />
        <Segmentado
          etiqueta="Ordenar stock"
          className="f-stock-orden"
          valor={orden}
          onCambiar={setOrden}
          opciones={[
            { valor: 'nombre', texto: 'A–Z', nombre: 'Orden: nombre' },
            { valor: 'stock', texto: 'Menos stock', nombre: 'Orden: menos stock' },
            { valor: 'precio', texto: 'Precio', nombre: 'Orden: mayor precio' },
            ...(editaCatalogo ? [{ valor: 'margen' as const, texto: 'Margen', nombre: 'Orden: mayor margen' }] : []),
          ]}
        />
      </div>

      <div className="f-stock-filtros">
        <Chip activo={soloAlertas} onClick={() => setSoloAlertas((actual) => !actual)}><IconoAlerta />Con datos para revisar</Chip>
        {categorias.length > 0 && (
          <select aria-label="Filtrar por categoría" className="f-entrada f-stock-categoria" value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
          </select>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="f-texto f-stock-nada">No encontramos productos con esos filtros.</p>
      ) : (
        <div className="f-stock-tabla" data-costos={editaCatalogo ? 'true' : 'false'}>
          <div className="f-stock-cabeza" aria-hidden="true">
            <span style={{ gridArea: 'nombre' }}>Producto</span><span style={{ gridArea: 'hay' }}>Hay</span>{editaCatalogo && <span className="f-stock-der" style={{ gridArea: 'costo' }}>Costo</span>}<span className="f-stock-der" style={{ gridArea: 'precio' }}>Precio</span>{editaCatalogo && <span className="f-stock-der" style={{ gridArea: 'gana' }}>Ganás</span>}
          </div>
          <ul className="f-stock-lista">
            {visibles.map((producto) => {
              const sinPrecio = precioVigente(producto) <= 0
              const bajoCosto = producto.precio > 0 && producto.precio < producto.costo
              return (
                <li key={producto.id} className="f-stock-fila">
                  <div className="f-stock-nombre">
                    <span className="f-renglon-titulo">{producto.nombre}</span>
                    <span className="f-renglon-detalle">{[producto.categoria, producto.codigoBarras ?? 'sin código'].filter(Boolean).join(' · ')}</span>
                  </div>
                  <button type="button" aria-label={producto.favorito ? 'Quitar favorito' : 'Agregar favorito'} title={producto.nombre} className="f-icono-boton f-stock-fav" data-active={producto.favorito ? 'true' : 'false'} onClick={() => void repos.productos.marcarFavorito(producto.id, !producto.favorito)}><IconoFavorito /></button>
                  <div className="f-stock-hay">
                    {producto.stock <= 0
                      ? <Etiqueta tono="gris">Sin stock</Etiqueta>
                      : enMinimo(producto)
                        ? <Etiqueta tono="ambar"><span className="f-stock-solo-celu">Quedan&nbsp;</span>{producto.stock}</Etiqueta>
                        : <span className="f-stock-cantidad"><span className="f-stock-solo-celu">Quedan </span>{producto.stock}</span>}
                  </div>
                  {editaCatalogo && <span className="f-stock-costo"><i className="f-stock-rotulo">Costo </i>{formatearPesos(producto.costo)}</span>}
                  <div className="f-stock-precio">
                    {sinPrecio
                      ? (editaCatalogo
                        ? <button type="button" className="f-stock-poner" aria-label={`Poner precio a ${producto.nombre}`} onClick={() => setEditando(producto)}>Poner precio</button>
                        : <Etiqueta tono="ambar">Sin precio</Etiqueta>)
                      : <strong className="f-plata f-stock-precio-valor">{formatearPesos(precioVigente(producto))}</strong>}
                  </div>
                  {editaCatalogo && <span className="f-stock-gana" data-tono={sinPrecio ? 'nada' : bajoCosto ? 'ambar' : 'verde'}><i className="f-stock-rotulo">Ganás </i>{sinPrecio ? '—' : `${margenProducto(producto)}%`}</span>}
                  {(editaCatalogo || ajustaStock) && (
                    <div className="f-stock-acciones-fila">
                      {editaCatalogo && <Boton variante="secundario" tamano="chico" aria-label={`Editar ${producto.nombre}`} onClick={() => setEditando(producto)}>Editar</Boton>}
                      {ajustaStock && <button type="button" className="f-icono-boton f-stock-accion" aria-label={`Ajustar stock de ${producto.nombre}`} title="Ajustar cuántos hay" onClick={() => setAjustando(producto)}><IconoMovimiento /></button>}
                      {editaCatalogo && <button type="button" className="f-icono-boton f-stock-accion" aria-label={`Ver rendimiento de ${producto.nombre}`} title="Ver cuánto rinde" onClick={() => setDetalle(producto)}><IconoPlata /></button>}
                      {editaCatalogo && <button type="button" className="f-icono-boton f-stock-borrar" aria-label={`Eliminar ${producto.nombre}`} title="Eliminar producto" onClick={() => solicitarEliminacion(producto)}><IconoEliminar /></button>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Hoja abierta={Boolean(ajustando)} onCerrar={() => setAjustando(null)} titulo={ajustando ? `Ajustar ${ajustando.nombre}` : 'Ajustar existencias'} ancho="angosto">
        {ajustando && ajustaStock && <AjustarStock producto={ajustando} onTerminado={() => setAjustando(null)} />}
      </Hoja>

      <Hoja abierta={Boolean(detalle) && editaCatalogo} onCerrar={() => setDetalle(null)} titulo={detalle ? `Rendimiento de ${detalle.nombre}` : 'Rendimiento'} ancho="angosto">
        {detalle && <DetalleProducto producto={detalle} />}
      </Hoja>

      <Hoja abierta={Boolean(editando) && editaCatalogo} onCerrar={() => setEditando(null)} titulo={editando ? `Editar ${editando.nombre}` : 'Editar producto'}>
        {editando && <FormularioProducto key={editando.id} producto={editando} onGuardado={() => setEditando(null)} onCancel={() => setEditando(null)} />}
      </Hoja>

      {editaCatalogo && productoAEliminar && (
        <div className="f-hoja-capa" onPointerDown={(evento) => { if (evento.target === evento.currentTarget && !borrandoProducto) setProductoAEliminar(null) }}>
          <div className="f-hoja" data-ancho="angosto" role="alertdialog" aria-modal="true" aria-labelledby="stock-delete-title" aria-describedby="stock-delete-texto">
            <div className="f-hoja-cabeza">
              <span className="f-hoja-manija" aria-hidden="true" />
              <h2 id="stock-delete-title" className="f-hoja-titulo">¿Eliminar {productoAEliminar.nombre}?</h2>
            </div>
            <div className="f-hoja-cuerpo">
              <p id="stock-delete-texto" className="f-hoja-ayuda">Se quitará del catálogo y de las próximas ventas. Si ya tiene ventas, ingresos o pedidos, lo vamos a conservar para no romper tu historial.</p>
              <div className="f-stock-acciones">
                <Boton variante="cuidado" disabled={borrandoProducto} onClick={() => void confirmarEliminacion()}>{borrandoProducto ? 'Eliminando…' : 'Sí, eliminar'}</Boton>
                <button type="button" ref={cancelarBorrado} className="f-boton f-boton-secundario" onClick={() => setProductoAEliminar(null)} disabled={borrandoProducto}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
