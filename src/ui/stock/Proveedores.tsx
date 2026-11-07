'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { ErrorProveedorInvalido, repos } from '@/datos/local/repos'
import type { Producto, Proveedor } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { comprasDelProveedor, costoDeIngreso, mensajePedidoProveedor, pedidoSugerido, textoDeuda } from '@/dominio/proveedores'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoCalendario, IconoProveedor, IconoWhatsApp } from '@/ui/sistema/iconos'
import { noSePudo } from '@/ui/sistema/textos'
import { useDestino } from '@/ui/sistema/destino'

const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' })
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** La pestaña Proveedores de Stock: a quién le comprás, cuándo pasa, cuánto
 *  le debés y el pedido armado para mandarle por WhatsApp. */
export function Proveedores() {
  const datos = useLiveQuery(async () => {
    const [proveedores, productos, ventas, negocio] = await Promise.all([
      repos.proveedores.todos(),
      repos.productos.todos(),
      repos.ventas.todas(),
      db.negocio.get('unico'),
    ])
    return { proveedores, productos, ventas, negocio }
  }, [], null)
  const [ahora] = useState(() => Date.now())
  const [abierto, setAbierto] = useState<string | null>(null)
  useDestino('/stock', (parametros) => {
    const proveedor = parametros.get('proveedor')
    if (proveedor) setAbierto(proveedor)
  })
  const [creando, setCreando] = useState(false)

  if (!datos) return null
  const { proveedores, productos, ventas } = datos
  const elegido = proveedores.find((proveedor) => proveedor.id === abierto) ?? null

  return (
    <section className="f-proveedores" aria-labelledby="proveedores-titulo">
      <div className="f-proveedores-cabeza">
        <div>
          <h2 id="proveedores-titulo" className="f-seccion">Proveedores</h2>
          <p className="f-stock-ayuda">A quién le comprás. Asignale sus productos y la app te arma el pedido.</p>
        </div>
        {proveedores.length > 0 && <Boton variante="principal" onClick={() => setCreando(true)}>+ Nuevo proveedor</Boton>}
      </div>

      {proveedores.length === 0 ? (
        <EstadoVacio
          icono={<IconoProveedor />}
          titulo="Todavía no cargaste proveedores"
          texto="Cargá a quién le comprás, cuándo pasa y qué te vende. Después te armamos el pedido con lo que falta."
          accion={{ etiqueta: 'Cargar el primero', alTocar: () => setCreando(true) }}
        />
      ) : (
        <div className="f-proveedores-lista">
          {proveedores.map((proveedor) => {
            const suyos = productos.filter((producto) => producto.proveedorId === proveedor.id)
            const faltan = pedidoSugerido(proveedor, productos, ventas, ahora).length
            return (
              <button key={proveedor.id} type="button" className="f-proveedor" onClick={() => setAbierto(proveedor.id)} aria-label={`Abrir ${proveedor.nombre}`}>
                <span className="f-proveedor-cabeza">
                  <strong>{proveedor.nombre}</strong>
                  {faltan > 0 ? <Etiqueta tono="ambar">{faltan} para pedir</Etiqueta> : <Etiqueta tono="verde">Al día</Etiqueta>}
                </span>
                {proveedor.visita && <span className="f-proveedor-visita"><IconoCalendario /> Pasa {proveedor.visita}</span>}
                <span className="f-proveedor-pie">
                  <span>{suyos.length} {suyos.length === 1 ? 'producto' : 'productos'}</span>
                  <span data-debe={proveedor.deuda > 0 ? 'true' : undefined}>{textoDeuda(proveedor.deuda)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {creando && <FormularioProveedor onCerrar={() => setCreando(false)} onGuardado={(nuevo) => { setCreando(false); setAbierto(nuevo.id) }} />}
      {elegido && (
        <DetalleProveedor
          proveedor={elegido}
          productos={productos}
          negocio={datos.negocio?.nombre || 'mi negocio'}
          pedido={pedidoSugerido(elegido, productos, ventas, ahora)}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </section>
  )
}

function FormularioProveedor({ proveedor, onCerrar, onGuardado }: { proveedor?: Proveedor; onCerrar: () => void; onGuardado: (proveedor: Proveedor) => void }) {
  const [nombre, setNombre] = useState(proveedor?.nombre ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [visita, setVisita] = useState(proveedor?.visita ?? '')
  const [deuda, setDeuda] = useState(proveedor && proveedor.deuda > 0 ? String(proveedor.deuda / 100) : '')
  const [nota, setNota] = useState(proveedor?.nota ?? '')
  const [aviso, setAviso] = useState<string | null>(null)

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    try {
      const guardado = await repos.proveedores.guardar({
        id: proveedor?.id,
        nombre,
        telefono,
        visita,
        nota,
        deuda: deuda.trim() ? pesosACentavos(Number(deuda.replace(/\./g, '').replace(',', '.')) || 0) : 0,
      })
      onGuardado(guardado)
    } catch (error) {
      setAviso(error instanceof ErrorProveedorInvalido ? error.message : noSePudo('guardar', 'el proveedor'))
    }
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} ancho="angosto">
      <form className="f-proveedor-form" onSubmit={(evento) => void guardar(evento)}>
        <label className="f-campo">
          <span>Nombre <em>obligatorio</em></span>
          <input aria-label="Nombre del proveedor" autoFocus className="f-entrada" placeholder="Ej. Distribuidora Norte" value={nombre} onChange={(evento) => setNombre(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>WhatsApp <em>para mandarle el pedido</em></span>
          <input aria-label="Teléfono del proveedor" inputMode="tel" className="f-entrada" placeholder="261 555 1234" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>¿Cuándo pasa? <em>opcional</em></span>
          <input aria-label="Cuándo pasa" className="f-entrada" placeholder="Ej. martes y viernes a la mañana" value={visita} onChange={(evento) => setVisita(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>¿Cuánto le debés? <em>opcional</em></span>
          <input aria-label="Deuda con el proveedor" inputMode="decimal" className="f-entrada" placeholder="$ 0" value={deuda} onChange={(evento) => setDeuda(evento.target.value)} />
        </label>
        <label className="f-campo">
          <span>Nota <em>opcional</em></span>
          <input aria-label="Nota del proveedor" className="f-entrada" placeholder="Ej. pedir antes del lunes" value={nota} onChange={(evento) => setNota(evento.target.value)} />
        </label>
        {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
        <Boton type="submit" variante="principal" ancho>{proveedor ? 'Guardar cambios' : 'Guardar proveedor'}</Boton>
      </form>
    </Hoja>
  )
}

function DetalleProveedor({
  proveedor,
  productos,
  negocio,
  pedido,
  onCerrar,
}: {
  proveedor: Proveedor
  productos: Producto[]
  negocio: string
  pedido: Array<{ producto: Producto; cantidad: number }>
  onCerrar: () => void
}) {
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [pago, setPago] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const compras = useLiveQuery(async () => comprasDelProveedor(proveedor, await db.ingresos.toArray()).slice(0, 5), [proveedor.nombre], [])

  const renglones = pedido.map((renglon) => ({ ...renglon, cantidad: cantidades[renglon.producto.id] !== undefined ? Number(cantidades[renglon.producto.id]) || 0 : renglon.cantidad }))
  const mensaje = mensajePedidoProveedor(negocio, proveedor, renglones)
  const suyos = productos.filter((producto) => producto.proveedorId === proveedor.id)
  const candidatos = useMemo(() => {
    const aguja = normalizar(busqueda.trim())
    if (!aguja) return []
    return productos.filter((producto) => producto.proveedorId !== proveedor.id && normalizar(producto.nombre).includes(aguja)).slice(0, 8)
  }, [busqueda, productos, proveedor.id])

  async function registrarPago() {
    const monto = pesosACentavos(Number(pago.replace(/\./g, '').replace(',', '.')) || 0)
    if (monto <= 0) return
    await repos.proveedores.guardar({ ...proveedor, deuda: Math.max(0, proveedor.deuda - monto) })
    setPago('')
  }

  if (editando) return <FormularioProveedor proveedor={proveedor} onCerrar={() => setEditando(false)} onGuardado={() => setEditando(false)} />

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={proveedor.nombre}>
      <div className="f-proveedor-detalle">
        <p className="f-hoja-ayuda">
          {[proveedor.visita && `Pasa ${proveedor.visita}`, proveedor.telefono, proveedor.nota].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
        </p>

        <Tarjeta como="section" className="f-proveedor-bloque" aria-labelledby="prov-pedido">
          <h3 id="prov-pedido" className="f-renglon-texto">Pedido sugerido</h3>
          {renglones.length === 0 ? (
            <p className="f-stock-ayuda">{suyos.length === 0 ? 'Asignale productos (abajo) y acá vas a ver qué pedirle.' : 'Con lo que tenés alcanza: no hace falta pedirle nada todavía.'}</p>
          ) : (
            <>
              <ul className="f-proveedor-pedido">
                {renglones.map((renglon) => (
                  <li key={renglon.producto.id}>
                    <span>{renglon.producto.nombre}<small>Quedan {renglon.producto.stock}</small></span>
                    <input
                      aria-label={`Cuánto pedir de ${renglon.producto.nombre}`}
                      inputMode="decimal"
                      className="f-entrada"
                      value={cantidades[renglon.producto.id] ?? String(renglon.cantidad)}
                      onChange={(evento) => setCantidades((actual) => ({ ...actual, [renglon.producto.id]: evento.target.value.replace(/[^\d.,]/g, '') }))}
                    />
                  </li>
                ))}
              </ul>
              <a className={clasesBoton('principal', 'f-boton-ancho')} target="_blank" rel="noopener noreferrer" href={enlaceWhatsApp(proveedor.telefono ?? '', mensaje)}>
                <IconoWhatsApp /> Mandar pedido por WhatsApp
              </a>
            </>
          )}
        </Tarjeta>

        <Tarjeta como="section" className="f-proveedor-bloque" aria-labelledby="prov-deuda">
          <h3 id="prov-deuda" className="f-renglon-texto">{textoDeuda(proveedor.deuda)}</h3>
          {proveedor.deuda > 0 && (
            <form className="f-proveedor-pago" onSubmit={(evento) => { evento.preventDefault(); void registrarPago() }}>
              <input aria-label="Cuánto le pagaste" inputMode="decimal" className="f-entrada" placeholder="$ cuánto le pagaste" value={pago} onChange={(evento) => setPago(evento.target.value)} />
              <Boton type="submit" variante="secundario">Le pagué</Boton>
            </form>
          )}
        </Tarjeta>

        <Tarjeta como="section" className="f-proveedor-bloque" aria-labelledby="prov-productos">
          <h3 id="prov-productos" className="f-renglon-texto">Sus productos ({suyos.length})</h3>
          {suyos.length > 0 && (
            <ul className="f-proveedor-productos">
              {suyos.map((producto) => (
                <li key={producto.id}>
                  <span>{producto.nombre}</span>
                  <button type="button" className="f-proveedor-quitar" onClick={() => void repos.productos.asignarProveedor(producto.id, null)} aria-label={`Quitar ${producto.nombre} de ${proveedor.nombre}`}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
          <label className="f-campo">
            <span>Agregar productos</span>
            <input aria-label="Buscar producto para agregar" className="f-entrada" placeholder="Buscá por nombre" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
          </label>
          {candidatos.length > 0 && (
            <ul className="f-proveedor-productos">
              {candidatos.map((producto) => (
                <li key={producto.id}>
                  <span>{producto.nombre}</span>
                  <button type="button" className="f-proveedor-agregar" onClick={() => void repos.productos.asignarProveedor(producto.id, proveedor.id)} aria-label={`Agregar ${producto.nombre} a ${proveedor.nombre}`}>Agregar</button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {compras.length > 0 && (
          <Tarjeta como="section" className="f-proveedor-bloque" aria-labelledby="prov-compras">
            <h3 id="prov-compras" className="f-renglon-texto">Últimas compras</h3>
            <ul className="f-proveedor-productos">
              {compras.map((compra) => (
                <li key={compra.id}>
                  <span>{FECHA.format(new Date(compra.fecha))} · {compra.items.length} {compra.items.length === 1 ? 'producto' : 'productos'}</span>
                  <strong className="f-plata">{formatearPesos(costoDeIngreso(compra))}</strong>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        <div className="f-proveedor-acciones">
          <Boton variante="secundario" onClick={() => setEditando(true)}>Editar datos</Boton>
          {quitando ? (
            <Boton variante="cuidado" onClick={() => { void repos.proveedores.eliminar(proveedor.id); onCerrar() }}>Sí, quitar proveedor</Boton>
          ) : (
            <Boton variante="cuidado" onClick={() => setQuitando(true)}>Quitar proveedor</Boton>
          )}
        </div>
      </div>
    </Hoja>
  )
}
