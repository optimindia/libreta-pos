'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ItemVenta, MedioPago, Negocio, Producto, UUID, Venta } from '@/dominio/tipos'
import { agregarProducto, cambiarCantidad, precioVigente, totalTicket } from '@/dominio/ticket'
import { ErrorStockInsuficiente, ErrorVentaInvalida, repos } from '@/datos/local/repos'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { Ticket, VaciarVenta } from './Ticket'
import { Cobro, OPCIONES_PAGO, type MedioCobro } from './Cobro'
import { BotonEscanear } from './BotonEscanear'
import { CatalogoVender } from './CatalogoVender'
import { Entrar } from './Entrar'
import { Cobrado } from './Cobrado'
import { PonerPrecio } from './PonerPrecio'
import { IconoCerrar } from '@/ui/sistema/iconos'
import { Boton } from '@/ui/sistema/Boton'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { formatearPesos } from '@/dominio/dinero'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'

/** Mientras el almacenero no configure su negocio, el ticket lleva el
 *  mismo nombre provisorio que muestra la cabecera. */
const NEGOCIO_POR_DEFECTO: Negocio = { id: 'unico', nombre: 'Tu almacén', logo: null, color: null }

export function PantallaVender() {
  const [items, setItems] = useState<ItemVenta[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [verTicket, setVerTicket] = useState(false)
  const [medio, setMedio] = useState<MedioCobro>('efectivo')
  const [cobrada, setCobrada] = useState<Venta | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [deCero, setDeCero] = useState(false)
  const [avisoStock, setAvisoStock] = useState<string | null>(null)
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

  const total = totalTicket(items)

  // El aviso es un cartelito pasajero, como en el celu: se va solo.
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

  async function cobrar(medio: MedioPago, clienteId: UUID | null = null, vence: number | null = null, referenciaPago?: string) {
    if (items.length === 0) return
    if (medio === 'fiado' && !clienteId) return
    try {
      const venta = await repos.ventas.registrar({ items, medioPago: medio, clienteId, vence, referenciaPago })
      setItems([])
      setCobrando(false)
      setMedio('efectivo')
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

  function elegirProducto(producto: Producto) {
    const enTicket = items.find((item) => item.productoId === producto.id)?.cantidad ?? 0
    const quedan = disponible(producto)
    if (quedan <= enTicket) {
      const reservado = (reservadas.get(producto.id) ?? 0) > 0
      setAvisoStock(
        quedan === 0
          ? `${producto.nombre} está sin stock${reservado ? ' (lo que hay está reservado para pedidos)' : ''}.`
          : `Solo quedan ${quedan} unidades de ${producto.nombre} y ya están en el ticket.`,
      )
      return
    }
    if (precioVigente(producto) <= 0) {
      setAvisoStock(null)
      setSinPrecio(producto)
      return
    }
    setAvisoStock(null)
    setItems((actuales) => agregarProducto(actuales, producto))
  }

  async function leerCodigo(codigo: string) {
    const producto = await repos.productos.porCodigoBarras(codigo)
    if (!producto) {
      setAvisoStock(`No encontramos el código ${codigo}. Cargalo en Stock para venderlo.`)
      return
    }
    elegirProducto(producto)
  }

  useEffect(() => {
    if (!escanerVenta) return
    function capturarLector(evento: KeyboardEvent) {
      const elemento = evento.target as HTMLElement | null
      const escribiendo = elemento?.tagName === 'INPUT' || elemento?.tagName === 'TEXTAREA' || elemento?.tagName === 'SELECT'
      if (escribiendo || evento.metaKey || evento.ctrlKey || evento.altKey) return
      const ahora = Date.now()
      if (evento.key === 'Enter') {
        const codigo = lector.current.codigo
        const fueRapido = codigo.length >= 4 && ahora - lector.current.ultimoTecla < 180
        lector.current = { codigo: '', ultimoTecla: 0 }
        if (fueRapido) {
          evento.preventDefault()
          void leerCodigo(codigo)
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

  return (
    <div className="f-vender">
      {/* Con una hoja abierta, lo de atrás no se lee ni se toca. */}
      <div className="f-vender-marco" aria-hidden={hojaAbierta || undefined} inert={hojaAbierta || undefined}>
        <h1 className="f-sr">Vender</h1>

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
              atajos={atajosPc}
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
                {hayItems && <VaciarVenta onVaciar={() => { setItems([]); setVerTicket(false) }} />}
                <button type="button" className="f-hoja-cerrar f-venta-cerrar" aria-label="Volver a los productos" onClick={() => setVerTicket(false)}><IconoCerrar /></button>
              </div>

              <div className="f-venta-lista">
                <Ticket
                  items={items}
                  stockPorProducto={disponibles}
                  onCambiarCantidad={(productoId, cantidad) =>
                    setItems((actuales) => cambiarCantidad(actuales, productoId, cantidad))
                  }
                  onSinStock={(productoId) => {
                    const producto = productos.find((item) => item.id === productoId)
                    if (producto) setAvisoStock(`Solo quedan ${disponible(producto)} unidades de ${producto.nombre}.`)
                  }}
                />
              </div>

              <div className="f-venta-pie">
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

      {avisoStock && <p className="f-aviso-flotante" role="status">{avisoStock}</p>}

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

      {cobrando && <Cobro total={total} medioInicial={medio} onCobrar={cobrar} onCancelar={() => setCobrando(false)} />}

      {cobrada && (
        <Cobrado
          venta={cobrada}
          negocio={estado?.negocio ?? NEGOCIO_POR_DEFECTO}
          onNueva={() => setCobrada(null)}
        />
      )}
    </div>
  )
}
