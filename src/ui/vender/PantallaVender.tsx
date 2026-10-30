'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MedioPago, Negocio, Producto, UUID, Venta } from '@/dominio/tipos'
import { agregarProducto, cambiarCantidad, precioVigente, totalTicket } from '@/dominio/ticket'
import { ErrorStockInsuficiente, ErrorVentaInvalida, repos } from '@/datos/local/repos'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { Ticket, VaciarVenta } from './Ticket'
import { TiraVentas } from './TiraVentas'
import { HojaDescuento } from './HojaDescuento'
import { useVentasAbiertas } from './usoVentasAbiertas'
import { ahorroTotal, itemsParaCobrar, masVendidos, MAX_VENTAS_ABIERTAS, repetirVenta, ventaConContenido, ventaNueva, type Descuento } from '@/dominio/ventaAbierta'
import { Cobro, OPCIONES_PAGO, type MedioCobro } from './Cobro'
import { BotonEscanear } from './BotonEscanear'
import { CatalogoVender } from './CatalogoVender'
import { Entrar } from './Entrar'
import { Cobrado } from './Cobrado'
import { PonerPrecio } from './PonerPrecio'
import { IconoCerrar } from '@/ui/sistema/iconos'
import { avisarLectura } from '@/ui/escaner/sonido'
import { Boton } from '@/ui/sistema/Boton'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { formatearPesos } from '@/dominio/dinero'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { useMarcarVentaAbierta } from '@/ui/sistema/actualizacionSW'
import { AnuncioVivo } from '@/ui/sistema/AnuncioVivo'

/** Mientras el almacenero no configure su negocio, el ticket lleva el
 *  mismo nombre provisorio que muestra la cabecera. */
const SIN_VENTA = ventaNueva('sin-cargar', 0)
const NEGOCIO_POR_DEFECTO: Negocio = { id: 'unico', nombre: 'Tu almacén', logo: null, color: null }

export function PantallaVender() {
  const { ventas, activa: activaGuardada, items, setItems, setNombre, setDescuentoItem, setDescuentoTotal, nueva, elegir, cerrar } = useVentasAbiertas()
  // Mientras se leen las ventas guardadas (un instante) se muestra una en blanco.
  const activa = activaGuardada ?? SIN_VENTA
  const [descontando, setDescontando] = useState<{ productoId: UUID | null } | null>(null)
  const [cobrando, setCobrando] = useState(false)
  const [verTicket, setVerTicket] = useState(false)
  const [medio, setMedio] = useState<MedioCobro>('efectivo')
  const [cobrada, setCobrada] = useState<Venta | null>(null)
  const [pagoCon, setPagoCon] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [deCero, setDeCero] = useState(false)
  const [avisoStock, setAvisoStock] = useState<string | null>(null)
  const [lecturaOk, setLecturaOk] = useState<string | null>(null)
  const lector = useRef({ codigo: '', ultimoTecla: 0 })
  const { funciones } = useFuncionesNegocio()
  const escanerVenta = funcionActiva(funciones, 'escanerVenta')
  const atajosPc = funcionActiva(funciones, 'atajosPc')
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  // Lo reservado para pedidos no se puede vender en el mostrador: el
  // catálogo y el ticket muestran lo que de verdad queda.
  const reservadas = useLiveQuery(() => repos.pedidos.reservadasPorProducto(), [], new Map<UUID, number>())
  const [sinPrecio, setSinPrecio] = useState<Producto | null>(null)
  const disponible = (producto: Producto) => Math.max(0, producto.stock - (reservadas.get(producto.id) ?? 0))
  const disponibles = Object.fromEntries(productos.map((producto) => [producto.id, disponible(producto)]))
  const estado = useLiveQuery(async () => {
    const [productos, ventas, negocio] = await Promise.all([
      db.productos.count(),
      db.ventas.count(),
      db.negocio.get('unico'),
    ])
    return { productos, ventas, negocio }
  })
  const aparatoNuevo =
    !deCero &&
    estado &&
    estado.productos === 0 &&
    estado.ventas === 0 &&
    !estado.negocio?.negocioId &&
    nubeActiva()

  // Lo que se cobra es el ticket con sus descuentos; la venta guarda el precio de lista.
  const cobrables = itemsParaCobrar(activa)
  const total = totalTicket(cobrables)
  const ahorro = ahorroTotal(activa)
  const masVendidosHoy = useLiveQuery(async () => {
    const desde = Date.now() - 30 * 24 * 60 * 60 * 1000
    return db.ventas.where('fecha').above(desde).toArray()
  }, [])
  const ultimaVenta = useLiveQuery(() => db.ventas.orderBy('fecha').reverse().filter((venta) => venta.estado === 'completada' && venta.items.length > 0).first(), [])
  const hayVentaAbierta = ventas.some(ventaConContenido)
  // Con una venta a medias (o el ticket recién cobrado en pantalla) la app
  // no se recarga para actualizarse.
  useMarcarVentaAbierta(hayVentaAbierta || cobrando || Boolean(cobrada) || Boolean(sinPrecio))

  // El aviso es un cartelito pasajero, como en el celu: se va solo.
  useEffect(() => {
    if (!lecturaOk) return
    const reloj = window.setTimeout(() => setLecturaOk(null), 2200)
    return () => window.clearTimeout(reloj)
  }, [lecturaOk])

  useEffect(() => {
    if (!avisoStock) return
    const reloj = window.setTimeout(() => setAvisoStock(null), 4500)
    return () => window.clearTimeout(reloj)
  }, [avisoStock])

  useEffect(() => {
    if (!atajosPc) return
    function atajo(evento: KeyboardEvent) {
      const elemento = evento.target as HTMLElement | null
      const escribiendo = elemento?.tagName === 'INPUT' || elemento?.tagName === 'TEXTAREA' || elemento?.tagName === 'SELECT'
      if (evento.key === '/' && !escribiendo) {
        evento.preventDefault()
        document.querySelector<HTMLInputElement>('[aria-label="Buscar producto"]')?.focus()
      } else if (evento.key === 'Escape') {
        if (cobrando) setCobrando(false)
        else setBusqueda('')
      } else if (evento.key === 'Enter' && evento.ctrlKey && items.length > 0 && !cobrando) {
        evento.preventDefault()
        setCobrando(true)
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [atajosPc, cobrando, items.length])

  async function cobrar(medio: MedioPago, clienteId: UUID | null = null, vence: number | null = null, referenciaPago?: string, entregado?: number) {
    if (items.length === 0) return
    if (medio === 'fiado' && !clienteId) return
    try {
      const venta = await repos.ventas.registrar({ items: cobrables, medioPago: medio, clienteId, vence, referenciaPago })
      cerrar(activa.id)
      setCobrando(false)
      setMedio('efectivo')
      setPagoCon(medio === 'efectivo' && entregado !== undefined ? entregado : null)
      setCobrada(venta)
    } catch (error) {
      if (error instanceof ErrorStockInsuficiente) {
        setCobrando(false)
        setAvisoStock(`${error.producto}: quedan ${error.disponible}. Ajustá el ticket o cargá stock.`)
        return
      }
      if (error instanceof ErrorVentaInvalida) {
        setCobrando(false)
        setAvisoStock(error.message)
        return
      }
      throw error
    }
  }

  /** Suma el producto al ticket. Devuelve `null` si entró, o el motivo si no. */
  function elegirProducto(producto: Producto): string | null {
    const enTicket = items.find((item) => item.productoId === producto.id)?.cantidad ?? 0
    const quedan = disponible(producto)
    if (quedan <= enTicket) {
      const reservado = (reservadas.get(producto.id) ?? 0) > 0
      const motivo = quedan === 0
        ? `${producto.nombre} está sin stock${reservado ? ' (lo que hay está reservado para pedidos)' : ''}.`
        : `Solo quedan ${quedan} unidades de ${producto.nombre} y ya están en el ticket.`
      setAvisoStock(motivo)
      return motivo
    }
    if (precioVigente(producto) <= 0) {
      setAvisoStock(null)
      setSinPrecio(producto)
      return `${producto.nombre} no tiene precio todavía.`
    }
    setAvisoStock(null)
    setItems((actuales) => agregarProducto(actuales, producto))
    return null
  }

  /** Un código que llegó del lector físico (el "pi pi"): suena, y el
   *  cartelito dice qué entró o por qué no. `soloSiExiste` es para cuando el
   *  código cae en el buscador: si no es de ningún producto, se deja como
   *  búsqueda normal en vez de avisar que no existe. */
  async function leerCodigo(codigo: string, soloSiExiste = false): Promise<boolean> {
    const producto = await repos.productos.porCodigoBarras(codigo)
    if (!producto) {
      if (soloSiExiste) return false
      avisarLectura('falta')
      setAvisoStock(`No encontramos el código ${codigo}. Cargalo en Stock para venderlo.`)
      return true
    }
    const problema = elegirProducto(producto)
    if (problema) {
      avisarLectura('falta')
    } else {
      avisarLectura('ok')
      setLecturaOk(`✓ ${producto.nombre} · ${formatearPesos(precioVigente(producto))}`)
    }
    return true
  }

  useEffect(() => {
    if (!escanerVenta) return
    function capturarLector(evento: KeyboardEvent) {
      const elemento = evento.target as HTMLElement | null
      // El buscador de Vender sí cuenta: en la PC suele tener el foco y el
      // lector escribe ahí. Cualquier otro campo se respeta.
      const enElBuscador = elemento?.getAttribute('aria-label') === 'Buscar producto'
      const escribiendo = !enElBuscador && (elemento?.tagName === 'INPUT' || elemento?.tagName === 'TEXTAREA' || elemento?.tagName === 'SELECT')
      if (escribiendo || evento.metaKey || evento.ctrlKey || evento.altKey) return
      const ahora = Date.now()
      if (evento.key === 'Enter') {
        const codigo = lector.current.codigo
        const fueRapido = codigo.length >= 4 && ahora - lector.current.ultimoTecla < 180
        lector.current = { codigo: '', ultimoTecla: 0 }
        if (fueRapido) {
          evento.preventDefault()
          if (enElBuscador) {
            void leerCodigo(codigo, true).then((leido) => { if (leido) setBusqueda('') })
          } else {
            void leerCodigo(codigo)
          }
        }
        return
      }
      if (evento.key.length !== 1) return
      lector.current.codigo = ahora - lector.current.ultimoTecla > 100 ? evento.key : `${lector.current.codigo}${evento.key}`
      lector.current.ultimoTecla = ahora
    }
    window.addEventListener('keydown', capturarLector)
    return () => window.removeEventListener('keydown', capturarLector)
  })

  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)
  const cantidades = Object.fromEntries(items.map((item) => [item.productoId, item.cantidad]))
  const hayItems = items.length > 0
  const textoUnidades = `${unidades} ${unidades === 1 ? 'producto' : 'productos'}`
  const hojaAbierta = cobrando || Boolean(sinPrecio) || Boolean(cobrada)

  // En el celu, mientras hay una venta en curso, la barra de cobro ocupa el
  // lugar de la barra de secciones (ver f/navegacion.css).
  useEffect(() => {
    const raiz = document.documentElement
    if (hayItems) raiz.dataset.venta = 'abierta'
    else delete raiz.dataset.venta
    return () => { delete raiz.dataset.venta }
  }, [hayItems])

  // La venta abierta como hoja (celu) se cierra con Esc, como las demás.
  useEffect(() => {
    if (!verTicket) return
    const tecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setVerTicket(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [verTicket])

  /** Deja la venta actual guardada y abre otra en blanco. */
  function nuevaVenta() {
    if (!nueva()) {
      setAvisoStock(`Ya tenés ${MAX_VENTAS_ABIERTAS} ventas abiertas. Cobrá o descartá alguna para abrir otra.`)
      return
    }
    setVerTicket(false)
    setBusqueda('')
  }

  function repetirUltima() {
    if (!ultimaVenta) return
    const { items: repetidos, omitidos } = repetirVenta(ultimaVenta, productos, disponible)
    if (repetidos.length === 0) {
      setAvisoStock('No se pudo repetir la venta: ya no hay stock o precio de esos productos.')
      return
    }
    setItems(repetidos)
    setAvisoStock(omitidos.length > 0 ? `Repetimos la última venta, menos: ${omitidos.join(', ')}.` : null)
  }

  function aplicarDescuento(descuento: Descuento | null) {
    if (descontando?.productoId) setDescuentoItem(descontando.productoId, descuento)
    else setDescuentoTotal(descuento)
    setDescontando(null)
  }

  const populares = busqueda.trim() === '' ? masVendidos(masVendidosHoy ?? [], productos, 0, 6) : []
  const sobreDescuento = descontando
    ? descontando.productoId
      ? { titulo: 'Descuento del producto', inicial: activa.descuentoItems[descontando.productoId] ?? null, base: (() => { const renglon = activa.items.find((item) => item.productoId === descontando.productoId); return renglon ? renglon.precio * renglon.cantidad : 0 })() }
      : { titulo: 'Descuento de la venta', inicial: activa.descuentoTotal, base: totalTicket(itemsParaCobrar({ ...activa, descuentoTotal: null })) }
    : null

  return (
    <div className="f-vender">
      {/* Con una hoja abierta, lo de atrás no se lee ni se toca. */}
      <div className="f-vender-marco" aria-hidden={hojaAbierta || undefined} inert={hojaAbierta || undefined}>
        <h1 className="f-sr">Vender</h1>

        {!aparatoNuevo && (ventas.length > 1 || hayVentaAbierta) && (
          <TiraVentas ventas={ventas} activaId={activa.id} llena={ventas.length >= MAX_VENTAS_ABIERTAS} onElegir={(id) => { elegir(id); setVerTicket(false) }} onNueva={nuevaVenta} />
        )}

        {aparatoNuevo ? (
          <Entrar onListo={() => setDeCero(true)} />
        ) : (
          <div className="f-vender-cuerpo">
            <CatalogoVender
              productos={productos}
              disponibles={disponibles}
              cantidades={cantidades}
              busqueda={busqueda}
              onBuscar={setBusqueda}
              onElegir={elegirProducto}
              masVendidos={populares}
              atajos={atajosPc}
              lectorListo={escanerVenta}
              escaner={escanerVenta ? (
                <BotonEscanear
                  onProducto={elegirProducto}
                  onNoEncontrado={(codigo) => setAvisoStock(`No encontramos el código ${codigo}. Cargalo en Stock para venderlo.`)}
                />
              ) : undefined}
            />

            {verTicket && <div className="f-venta-capa" aria-hidden="true" onClick={() => setVerTicket(false)} />}
            <aside className="f-venta" data-abierta={verTicket ? 'true' : 'false'} aria-label="Venta en curso">
              <div className="f-venta-cabeza">
                <div className="f-venta-titulo">
                  <h2 className="f-seccion">Venta</h2>
                  <span className="f-dato">{textoUnidades}</span>
                </div>
                {hayItems && (
                  ventas.length > 1
                    ? <VaciarVenta etiqueta="Descartar venta" confirmar="Sí, descartar" onVaciar={() => { cerrar(activa.id); setVerTicket(false) }} />
                    : <VaciarVenta onVaciar={() => { setItems([]); setNombre(''); setVerTicket(false) }} />
                )}
                <button type="button" className="f-hoja-cerrar f-venta-cerrar" aria-label="Volver a los productos" onClick={() => setVerTicket(false)}><IconoCerrar /></button>
              </div>

              <div className="f-venta-lista">
                {(hayItems || activa.nombre !== '') && (
                  <input
                    className="f-venta-nombre"
                    aria-label="Nombre de la venta"
                    placeholder="Nombre o nota (opcional)"
                    maxLength={40}
                    autoComplete="off"
                    value={activa.nombre}
                    onChange={(evento) => setNombre(evento.target.value)}
                  />
                )}
                <Ticket
                  items={items}
                  cobrables={cobrables}
                  onDescuento={(productoId) => setDescontando({ productoId })}
                  stockPorProducto={disponibles}
                  onCambiarCantidad={(productoId, cantidad) =>
                    setItems((actuales) => cambiarCantidad(actuales, productoId, cantidad))
                  }
                  onSinStock={(productoId) => {
                    const producto = productos.find((item) => item.id === productoId)
                    if (producto) setAvisoStock(`Solo quedan ${disponible(producto)} unidades de ${producto.nombre}.`)
                  }}
                />
                {!hayItems && ultimaVenta && (
                  <Boton variante="secundario" ancho onClick={repetirUltima}>Repetir la última venta</Boton>
                )}
              </div>

              <div className="f-venta-pie">
                {hayItems && (
                  <div className="f-venta-descuento-fila">
                    {ahorro > 0 && <span className="f-dato">Descuento −{formatearPesos(ahorro)}</span>}
                    <button type="button" className="f-venta-descuento" onClick={() => setDescontando({ productoId: null })}>
                      {activa.descuentoTotal ? 'Cambiar descuento de la venta' : 'Descuento a toda la venta'}
                    </button>
                  </div>
                )}
                <div className="f-venta-total">
                  <span>Total</span>
                  <strong className="f-plata-48">{formatearPesos(total)}</strong>
                </div>
                <Segmentado etiqueta="Cómo paga" opciones={OPCIONES_PAGO} valor={medio} onCambiar={setMedio} className="f-venta-medio" />
                <Boton
                  variante="principal"
                  tamano="caja"
                  ancho
                  disabled={!hayItems}
                  aria-keyshortcuts={atajosPc ? 'Control+Enter' : undefined}
                  onClick={() => { setVerTicket(false); setCobrando(true) }}
                >
                  {hayItems ? `Cobrar ${formatearPesos(total)}` : 'Cobrar venta'}
                  {atajosPc && hayItems && <span className="f-tecla f-solo-pc" aria-hidden="true">Ctrl+Enter</span>}
                </Boton>
              </div>
            </aside>
          </div>
        )}

        {!aparatoNuevo && hayItems && (
          <div className="f-cobro-barra">
            <button type="button" className="f-cobro-barra-resumen" onClick={() => setVerTicket(true)} aria-label={`Ver la venta: ${textoUnidades}, ${formatearPesos(total)}`}>
              <span>{textoUnidades} · ver venta</span>
              <strong className="f-plata">{formatearPesos(total)}</strong>
            </button>
            <button
              type="button"
              className="f-cobro-barra-cobrar"
              aria-label="Cobrar"
              disabled={!hayItems}
              onClick={() => setCobrando(true)}
            >
              <span>Cobrar</span>
            </button>
          </div>
        )}
      </div>

      {/* Las regiones vivas están siempre montadas (se anuncia lo que se escribe
          adentro); los carteles de abajo son sólo para la vista. */}
      <AnuncioVivo nombre="venta" mensaje={hayItems ? `${textoUnidades}. Total ${formatearPesos(total)}` : ''} />
      <AnuncioVivo nombre="avisos" mensaje={avisoStock ?? lecturaOk ?? ''} />
      {avisoStock && <p className="f-aviso-flotante" aria-hidden="true">{avisoStock}</p>}
      {!avisoStock && lecturaOk && <p className="f-aviso-flotante" data-tono="ok" aria-hidden="true">{lecturaOk}</p>}

      {sinPrecio && (
        <PonerPrecio
          producto={sinPrecio}
          onCancelar={() => setSinPrecio(null)}
          onListo={(conPrecio) => {
            setSinPrecio(null)
            setItems((actuales) => agregarProducto(actuales, conPrecio))
          }}
        />
      )}

      {sobreDescuento && (
        <HojaDescuento titulo={sobreDescuento.titulo} base={sobreDescuento.base} inicial={sobreDescuento.inicial} onAplicar={aplicarDescuento} onCerrar={() => setDescontando(null)} />
      )}

      {cobrando && <Cobro total={total} medioInicial={medio} onCobrar={cobrar} onCancelar={() => setCobrando(false)} />}

      {cobrada && (
        <Cobrado
          venta={cobrada}
          negocio={estado?.negocio ?? NEGOCIO_POR_DEFECTO}
          pagoCon={pagoCon}
          onNueva={() => setCobrada(null)}
        />
      )}
    </div>
  )
}
