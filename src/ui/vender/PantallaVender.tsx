'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ItemVenta, MedioPago, Negocio, Producto, UUID, Venta } from '@/dominio/tipos'
import { agregarProducto, cambiarCantidad, precioVigente, totalTicket } from '@/dominio/ticket'
import { ErrorStockInsuficiente, ErrorVentaInvalida, repos } from '@/datos/local/repos'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { Ticket } from './Ticket'
import { Cobro } from './Cobro'
import { BotonEscanear } from './BotonEscanear'
import { CatalogoVender } from './CatalogoVender'
import { Entrar } from './Entrar'
import { Cobrado } from './Cobrado'
import { PonerPrecio } from './PonerPrecio'
import { IconoCerrar, IconoFlechaDerecha, IconoFlechaIzquierda } from '@/ui/sistema/iconos'
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

  const cobrarBoton = (
    <button
      type="button"
      className="mz-cobrar mz-toque"
      disabled={!hayItems}
      onClick={() => { setVerTicket(false); setCobrando(true) }}
    >
      Cobrar venta
    </button>
  )

  return (
    <div className="mz-mostrador">
      <header className="mz-mostrador-cabecera">
        <Link href="/" className="mz-redondo mz-toque" aria-label="Volver al inicio"><IconoFlechaIzquierda /></Link>
        <h1>Vender</h1>
      </header>

      {aparatoNuevo ? (
        <Entrar onListo={() => setDeCero(true)} />
      ) : (
        <div className="mz-mostrador-cuerpo">
          <CatalogoVender
            productos={productos}
            disponibles={disponibles}
            cantidades={cantidades}
            busqueda={busqueda}
            onBuscar={setBusqueda}
            onElegir={elegirProducto}
            escaner={escanerVenta ? (
              <BotonEscanear
                onProducto={elegirProducto}
                onNoEncontrado={(codigo) => setAvisoStock(`No encontramos el código ${codigo}. Cargalo en Stock para venderlo.`)}
              />
            ) : undefined}
          />

          <aside className={`mz-ticket-panel${verTicket ? ' is-abierto' : ''}`} aria-label="Ticket de la venta">
            <div className="mz-ticket-cabecera">
              <div>
                <span className="mz-subtitulo">Venta en curso</span>
                <h2>Tu ticket</h2>
              </div>
              <span className="mz-ticket-cuenta">{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
              <button type="button" className="mz-redondo mz-cerrar-ticket mz-toque" aria-label="Cerrar el ticket" onClick={() => setVerTicket(false)}><IconoCerrar /></button>
            </div>

            <Ticket
              items={items}
              stockPorProducto={disponibles}
              onVaciar={() => setItems([])}
              onCambiarCantidad={(productoId, cantidad) =>
                setItems((actuales) => cambiarCantidad(actuales, productoId, cantidad))
              }
              onSinStock={(productoId) => {
                const producto = productos.find((item) => item.id === productoId)
                if (producto) setAvisoStock(`Solo quedan ${disponible(producto)} unidades de ${producto.nombre}.`)
              }}
            />

            <div className="mz-ticket-total">
              <span>Total a cobrar</span>
              <strong className="tabular">{formatearPesos(total)}</strong>
            </div>
            {cobrarBoton}
          </aside>
        </div>
      )}

      {avisoStock && <p className="mz-aviso-stock" role="status">{avisoStock}</p>}

      {!aparatoNuevo && hayItems && (
        <div className="mz-barra-cobro">
          <button type="button" className="mz-barra-resumen" onClick={() => setVerTicket(true)} aria-label={`Ver el ticket: ${unidades} ${unidades === 1 ? 'producto' : 'productos'}, ${formatearPesos(total)}`}>
            <span>{unidades} {unidades === 1 ? 'producto' : 'productos'} · ver ticket</span>
            <strong className="tabular">{formatearPesos(total)}</strong>
          </button>
          <button
            type="button"
            className="mz-barra-cobrar mz-toque"
            aria-label="Cobrar"
            disabled={!hayItems}
            onClick={() => setCobrando(true)}
          >
            Cobrar <IconoFlechaDerecha />
          </button>
        </div>
      )}

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

      {cobrando && <Cobro total={total} onCobrar={cobrar} onCancelar={() => setCobrando(false)} />}

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
