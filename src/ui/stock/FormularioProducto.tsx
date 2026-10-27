'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Producto } from '@/dominio/tipos'
import { pesosACentavos } from '@/dominio/dinero'
import { hayErroresProducto, validarProducto, type ErroresProducto } from '@/dominio/validaciones'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { IconoEditar, IconoNuevaVenta } from '@/ui/sistema/iconos'

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
      const costoCentavos = pesosACentavos(Number(costo) || 0)
      const precioCentavos = pesosACentavos(Number(precio) || 0)
      const ofertaCentavos = precioOferta.trim() === '' ? undefined : pesosACentavos(Number(precioOferta) || 0)
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
      setAviso('No se pudo guardar el producto. Revisá los datos y probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form-shell product-form" onSubmit={(evento) => void guardar(evento)}>
      <div className="form-intro">
        <span className="form-intro-icon" aria-hidden="true">{producto ? <IconoEditar /> : <IconoNuevaVenta />}</span>
        <div>
          <strong>{producto ? 'Actualizá la ficha' : 'Cargá los datos básicos'}</strong>
          <p>{producto ? 'Los cambios se aplican al catálogo y a las próximas ventas.' : 'Con nombre, precio y stock ya podés empezar a vender.'}</p>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="form-step">1</span>
          <div><h3>Identificación</h3><p>Cómo vas a encontrar este artículo al vender.</p></div>
        </div>
        <label className="form-field">
          <span className="form-field-label">Nombre <em>obligatorio</em></span>
          <input
            aria-label="Nombre"
            autoFocus={!producto}
            placeholder="Ej. Yerba Playadito"
            className="form-input"
            value={nombre}
            aria-invalid={Boolean(errores.nombre)}
            onChange={(evento) => { setNombre(evento.target.value); setErrores((actuales) => ({ ...actuales, nombre: undefined })); setAviso(null) }}
          />
          <span className="form-field-help">Usá un nombre corto y reconocible para encontrarlo rápido.</span>
          {errores.nombre && <span className="form-error" role="alert">{errores.nombre}</span>}
        </label>
        <label className="form-field">
          <span className="form-field-label">Categoría <em>opcional</em></span>
          <select
            aria-label="Categoría del producto"
            className="form-input form-category-select"
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
              className="form-input form-category-custom"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
            />
          )}
          <span className="form-field-help">Elegí una categoría para ordenar y filtrar tu catálogo más rápido.</span>
        </label>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="form-step">2</span>
          <div><h3>Precios</h3><p>Separá lo que te cuesta de lo que cobrás.</p></div>
        </div>
        <div className="form-field-row">
          <label className="form-field">
            <span className="form-field-label">Costo <em>lo que pagás</em></span>
            <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input aria-label="Costo" inputMode="decimal" placeholder="Ej. 800" className="form-input tabular" value={costo} aria-invalid={Boolean(errores.costo)} onChange={(evento) => { setCosto(evento.target.value); setErrores((actuales) => ({ ...actuales, costo: undefined })) }} /></div>
          </label>
          <label className="form-field">
            <span className="form-field-label">Precio <em>lo que cobrás</em></span>
            <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input aria-label="Precio" inputMode="decimal" placeholder="Ej. 1.200" className="form-input tabular" value={precio} aria-invalid={Boolean(errores.precio)} onChange={(evento) => { setPrecio(evento.target.value); setErrores((actuales) => ({ ...actuales, precio: undefined })) }} /></div>
          </label>
        </div>
        {(errores.costo || errores.precio) && <p className="form-error" role="alert">{errores.costo ?? errores.precio}</p>}
        <p className="form-callout">El costo sirve para calcular tu ganancia. El precio es el importe que verá el cliente.</p>
      </section>

      <section className="form-section product-offer-section">
        <div className="form-section-heading">
          <span className="form-step">＋</span>
          <div><h3>Oferta opcional</h3><p>Mostrá un precio especial sin perder el precio habitual.</p></div>
        </div>
        <div className="form-field-row">
          <label className="form-field">
            <span className="form-field-label">Precio oferta <em>opcional</em></span>
            <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input aria-label="Oferta promocional" inputMode="decimal" placeholder="Ej. 1.050" className="form-input tabular" value={precioOferta} onChange={(evento) => { setPrecioOferta(evento.target.value); setAviso(null) }} /></div>
          </label>
          <label className="form-field">
            <span className="form-field-label">Válida hasta <em>opcional</em></span>
            <input aria-label="Fin de la oferta" type="date" className="form-input" value={ofertaHasta} onChange={(evento) => { setOfertaHasta(evento.target.value); setAviso(null) }} />
          </label>
        </div>
        <span className="form-field-help">La oferta aparece en Vender y se copia al ticket; dejá ambos campos vacíos para quitarla.</span>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="form-step">3</span>
          <div><h3>Control de stock</h3><p>Definí cómo querés cuidar las existencias.</p></div>
        </div>
        <div className="form-field-row form-field-row-code">
          <label className="form-field">
            <span className="form-field-label">Código de barras <em>opcional</em></span>
            <input aria-label="Código de barras" inputMode="numeric" placeholder="Escaneá o escribí el código" className="form-input tabular" value={codigo} aria-invalid={Boolean(errores.codigoBarras)} onChange={(evento) => { setCodigo(evento.target.value); setErrores((actuales) => ({ ...actuales, codigoBarras: undefined })) }} />
            <span className="form-field-help">Podés usar el lector o dejarlo vacío.</span>
          </label>
          <label className="form-field">
            <span className="form-field-label">Mínimo <em>unidades</em></span>
            <input aria-label="Mínimo" inputMode="numeric" placeholder="3" className="form-input tabular" value={minimo} aria-invalid={Boolean(errores.stockMinimo)} onChange={(evento) => { setMinimo(evento.target.value); setErrores((actuales) => ({ ...actuales, stockMinimo: undefined })) }} />
            <span className="form-field-help">Te avisamos cuando llegues a este número.</span>
          </label>
        </div>
        {(errores.codigoBarras || errores.stockMinimo) && <p className="form-error" role="alert">{errores.codigoBarras ?? errores.stockMinimo}</p>}

        {!producto && (
          <label className="form-field form-stock-field">
            <span className="form-field-label">Stock inicial <em>unidades disponibles hoy</em></span>
            <input aria-label="Stock inicial" inputMode="numeric" placeholder="Ej. 12" className="form-input tabular" value={stockInicial} aria-invalid={Boolean(errores.stockInicial)} onChange={(evento) => { setStockInicial(evento.target.value); setErrores((actuales) => ({ ...actuales, stockInicial: undefined })) }} />
            <span className="form-field-help">Si todavía no tenés unidades, dejá 0. Después podés sumar ingresos.</span>
            {errores.stockInicial && <span className="form-error" role="alert">{errores.stockInicial}</span>}
          </label>
        )}
      </section>

      {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
      <div className="form-actions">
        <Boton variante="principal" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Guardar producto'}
        </Boton>
        {producto && onCancel && <Boton variante="secundario" type="button" onClick={onCancel}>Cancelar</Boton>}
      </div>
    </form>
  )
}
