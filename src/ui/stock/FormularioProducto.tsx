'use client'

import { useId, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Producto } from '@/dominio/tipos'
import { pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { hayErroresProducto, validarProducto, type ErroresProducto } from '@/dominio/validaciones'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { noSePudo } from '@/ui/sistema/textos'

const CATEGORIAS_SUGERIDAS = ['Almacén', 'Bebidas', 'Lácteos', 'Limpieza', 'Golosinas', 'Congelados', 'Panificados', 'Perfumería', 'Mascotas']

export function FormularioProducto({
  producto,
  codigoInicial,
  onGuardado,
  onCancel,
}: {
  producto?: Producto | null
  codigoInicial?: string
  onGuardado?: () => void
  onCancel?: () => void
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [categoria, setCategoria] = useState(producto?.categoria ?? '')
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState(false)
  const [costo, setCosto] = useState(producto ? String(producto.costo / 100) : '')
  const [precio, setPrecio] = useState(producto ? String(producto.precio / 100) : '')
  const [precioOferta, setPrecioOferta] = useState(producto?.precioOferta ? String(producto.precioOferta / 100) : '')
  const [ofertaHasta, setOfertaHasta] = useState(producto?.ofertaHasta ? new Date(producto.ofertaHasta).toISOString().slice(0, 10) : '')
  const [codigo, setCodigo] = useState(producto?.codigoBarras ?? codigoInicial ?? '')
  const [minimo, setMinimo] = useState(producto ? String(producto.stockMinimo) : '3')
  const [stockInicial, setStockInicial] = useState(producto ? String(producto.stock) : '0')
  const [errores, setErrores] = useState<ErroresProducto>({})
  const base = useId()
  const idError = { nombre: `${base}-nombre`, dinero: `${base}-dinero`, control: `${base}-control`, stock: `${base}-stock` }
  /** Un campo con error queda inválido y apunta a su mensaje (3.3.1). */
  const enlace = (hayError: boolean, id: string) => (hayError ? { 'aria-invalid': true as const, 'aria-describedby': id } : {})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  const categorias = [...new Set([
    ...CATEGORIAS_SUGERIDAS,
    ...(productos ?? []).map((item) => item.categoria).filter((item): item is string => Boolean(item?.trim())),
    ...(producto?.categoria ? [producto.categoria] : []),
  ])].sort((a, b) => a.localeCompare(b, 'es'))

  async function guardar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    setAviso(null)
    try {
      const costoCentavos = pesosACentavos(pesosDeTexto(costo))
      const precioCentavos = pesosACentavos(pesosDeTexto(precio))
      const ofertaCentavos = precioOferta.trim() === '' ? undefined : pesosACentavos(pesosDeTexto(precioOferta))
      const fechaOferta = ofertaHasta ? new Date(`${ofertaHasta}T23:59:59`).getTime() : undefined
      const stockMinimo = Number(minimo) || 0
      const stock = Number(stockInicial) || 0
      const existentes = await repos.productos.todos()
      const nuevosErrores = validarProducto({
        nombre,
        costo: costoCentavos,
        precio: precioCentavos,
        codigoBarras: codigo.trim() || null,
        stockMinimo,
      }, existentes, producto?.id)
      if (stock < 0 || !Number.isInteger(stock)) nuevosErrores.stockInicial = 'El stock inicial tiene que ser un entero desde cero.'
      if (ofertaCentavos !== undefined && (ofertaCentavos <= 0 || ofertaCentavos >= precioCentavos)) {
        setAviso('El precio de oferta debe ser mayor a cero y menor que el precio habitual.')
        return
      }
      if (ofertaHasta && (!fechaOferta || Number.isNaN(fechaOferta))) {
        setAviso('Revisá la fecha de finalización de la oferta.')
        return
      }
      if (hayErroresProducto(nuevosErrores)) {
        setErrores(nuevosErrores)
        return
      }

      setGuardando(true)
      await repos.productos.guardar({
        ...(producto ?? {}),
        nombre: nombre.trim(),
        codigoBarras: codigo.trim() || null,
        costo: costoCentavos,
        precio: precioCentavos,
        stock: producto ? producto.stock : stock,
        stockMinimo,
        categoria: categoria.trim() || undefined,
        precioOferta: ofertaCentavos,
        ofertaHasta: ofertaCentavos ? fechaOferta : undefined,
      })
      if (!producto) {
        setNombre(''); setCategoria(''); setCosto(''); setPrecio(''); setPrecioOferta(''); setOfertaHasta(''); setCodigo(''); setStockInicial('0')
      }
      onGuardado?.()
    } catch {
      setAviso(noSePudo('guardar', 'el producto'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="f-stock-form" onSubmit={(evento) => void guardar(evento)}>
      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Identificación</h3>
        <label className="f-campo">
          <span>Nombre <em>obligatorio</em></span>
          <input
            aria-label="Nombre"
            autoFocus={!producto}
            placeholder="Ej. Yerba Playadito"
            className="f-entrada"
            value={nombre}
            {...enlace(Boolean(errores.nombre), idError.nombre)}
            onChange={(evento) => { setNombre(evento.target.value); setErrores((actuales) => ({ ...actuales, nombre: undefined })); setAviso(null) }}
          />
          <small className="f-stock-ayuda">Un nombre corto y reconocible para encontrarlo rápido.</small>
          {errores.nombre && <small id={idError.nombre} className="f-stock-error" role="alert">{errores.nombre}</small>}
        </label>
        <label className="f-campo">
          <span>Categoría <em>opcional</em></span>
          <select
            aria-label="Categoría del producto"
            className="f-entrada"
            value={categoriaPersonalizada ? '__otra__' : categoria}
            onChange={(evento) => {
              const valor = evento.target.value
              setCategoriaPersonalizada(valor === '__otra__')
              setCategoria(valor === '__otra__' ? '' : valor)
            }}
          >
            <option value="">Sin categoría</option>
            {categorias.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
            <option value="__otra__">Otra categoría…</option>
          </select>
          {categoriaPersonalizada && (
            <input
              aria-label="Nueva categoría del producto"
              placeholder="Ej. Librería"
              className="f-entrada"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
            />
          )}
        </label>
      </section>

      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Precios</h3>
        <p className="f-stock-ayuda">El costo sirve para calcular tu ganancia. El precio es lo que ve el cliente.</p>
        <div className="f-stock-fila-campos">
          <label className="f-campo">
            <span>Costo <em>lo que pagás</em></span>
            <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Costo" inputMode="decimal" placeholder="Ej. 800" className="f-entrada" value={costo} {...enlace(Boolean(errores.costo || errores.precio), idError.dinero)} onChange={(evento) => { setCosto(evento.target.value); setErrores((actuales) => ({ ...actuales, costo: undefined })) }} /></div>
          </label>
          <label className="f-campo">
            <span>Precio <em>lo que cobrás</em></span>
            <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Precio" inputMode="decimal" placeholder="Ej. 1.200" className="f-entrada" value={precio} {...enlace(Boolean(errores.costo || errores.precio), idError.dinero)} onChange={(evento) => { setPrecio(evento.target.value); setErrores((actuales) => ({ ...actuales, precio: undefined })) }} /></div>
          </label>
        </div>
        {(errores.costo || errores.precio) && <p id={idError.dinero} className="f-stock-error" role="alert">{errores.costo ?? errores.precio}</p>}
      </section>

      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Oferta <em>opcional</em></h3>
        <p className="f-stock-ayuda">Aparece en Vender y se copia al ticket. Dejá los dos campos vacíos para quitarla.</p>
        <div className="f-stock-fila-campos">
          <label className="f-campo">
            <span>Precio oferta <em>opcional</em></span>
            <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Oferta promocional" inputMode="decimal" placeholder="Ej. 1.050" className="f-entrada" value={precioOferta} onChange={(evento) => { setPrecioOferta(evento.target.value); setAviso(null) }} /></div>
          </label>
          <label className="f-campo">
            <span>Válida hasta <em>opcional</em></span>
            <input aria-label="Fin de la oferta" type="date" className="f-entrada" value={ofertaHasta} onChange={(evento) => { setOfertaHasta(evento.target.value); setAviso(null) }} />
          </label>
        </div>
      </section>

      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Control de stock</h3>
        <div className="f-stock-fila-campos f-stock-fila-ancha">
          <label className="f-campo">
            <span>Código de barras <em>opcional</em></span>
            <input aria-label="Código de barras" inputMode="numeric" placeholder="Escaneá o escribí el código" className="f-entrada" value={codigo} {...enlace(Boolean(errores.codigoBarras || errores.stockMinimo), idError.control)} onChange={(evento) => { setCodigo(evento.target.value); setErrores((actuales) => ({ ...actuales, codigoBarras: undefined })) }} />
          </label>
          <label className="f-campo">
            <span>Mínimo <em>unidades</em></span>
            <input aria-label="Mínimo" inputMode="numeric" placeholder="3" className="f-entrada" value={minimo} {...enlace(Boolean(errores.codigoBarras || errores.stockMinimo), idError.control)} onChange={(evento) => { setMinimo(evento.target.value); setErrores((actuales) => ({ ...actuales, stockMinimo: undefined })) }} />
            <small className="f-stock-ayuda">Te avisamos cuando llegues a este número.</small>
          </label>
        </div>
        {(errores.codigoBarras || errores.stockMinimo) && <p id={idError.control} className="f-stock-error" role="alert">{errores.codigoBarras ?? errores.stockMinimo}</p>}

        {!producto && (
          <label className="f-campo">
            <span>Stock inicial <em>unidades disponibles hoy</em></span>
            <input aria-label="Stock inicial" inputMode="numeric" placeholder="Ej. 12" className="f-entrada" value={stockInicial} {...enlace(Boolean(errores.stockInicial), idError.stock)} onChange={(evento) => { setStockInicial(evento.target.value); setErrores((actuales) => ({ ...actuales, stockInicial: undefined })) }} />
            <small className="f-stock-ayuda">Si todavía no tenés unidades, dejá 0. Después podés sumar ingresos.</small>
            {errores.stockInicial && <small id={idError.stock} className="f-stock-error" role="alert">{errores.stockInicial}</small>}
          </label>
        )}
      </section>

      {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
      <div className="f-stock-acciones">
        <Boton variante="principal" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Guardar producto'}
        </Boton>
        {producto && onCancel && <Boton variante="secundario" type="button" onClick={onCancel}>Cancelar</Boton>}
      </div>
    </form>
  )
}
