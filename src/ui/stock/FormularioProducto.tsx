'use client'

import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Producto, UnidadVenta } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { formatearCantidad, leerCantidad, redondearCantidad } from '@/dominio/cantidad'
import { margenProducto } from '@/dominio/inteligencia'
import { hayErroresProducto, validarProducto, type ErroresProducto } from '@/dominio/validaciones'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Chip } from '@/ui/sistema/Chip'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { IconoEscanear } from '@/ui/sistema/iconos'
import { VisorCamara } from '@/ui/escaner/VisorCamara'
import { noSePudo } from '@/ui/sistema/textos'

const CATEGORIAS_SUGERIDAS = ['Almacén', 'Bebidas', 'Lácteos', 'Limpieza', 'Golosinas', 'Panificados']

const COMO_SE_VENDE = [
  { valor: 'unidad' as const, texto: 'Por unidad', nombre: 'Por unidad' },
  { valor: 'kg' as const, texto: 'Por kilo', nombre: 'Por kilo' },
  { valor: 'l' as const, texto: 'Por litro', nombre: 'Por litro' },
]

const textoCantidad = (valor: number) => String(valor).replace('.', ',')

/** La ficha de un producto, en el orden en que se carga en el mostrador:
 *  código (con el lector o la cámara), nombre, cómo se vende, precio y
 *  cuántos hay. Lo menos usado queda en "Más opciones". Cargando productos
 *  nuevos, "Guardar y cargar otro" deja la ficha lista para el siguiente con
 *  la misma categoría y forma de venta. */
export function FormularioProducto({
  producto,
  codigoInicial,
  escaner = false,
  onGuardado,
  onTerminar,
  onCancel,
}: {
  producto?: Producto | null
  codigoInicial?: string
  /** Muestra el botón de cámara al lado del código. */
  escaner?: boolean
  /** Se guardó un producto (en la tanda, cada uno). */
  onGuardado?: (producto: Producto) => void
  /** Cargando nuevos: se guardó y no hay más para cargar. */
  onTerminar?: () => void
  onCancel?: () => void
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [unidad, setUnidad] = useState<UnidadVenta>(producto?.unidad ?? 'unidad')
  const [categoria, setCategoria] = useState(producto?.categoria ?? '')
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null)
  const [costo, setCosto] = useState(producto ? String(producto.costo / 100) : '')
  const [precio, setPrecio] = useState(producto ? String(producto.precio / 100) : '')
  const [precioOferta, setPrecioOferta] = useState(producto?.precioOferta ? String(producto.precioOferta / 100) : '')
  const [ofertaHasta, setOfertaHasta] = useState(producto?.ofertaHasta ? new Date(producto.ofertaHasta).toISOString().slice(0, 10) : '')
  const [codigo, setCodigo] = useState(producto?.codigoBarras ?? codigoInicial ?? '')
  const [minimo, setMinimo] = useState(producto ? textoCantidad(producto.stockMinimo) : '3')
  const [stockInicial, setStockInicial] = useState(producto ? textoCantidad(producto.stock) : '')
  const [errores, setErrores] = useState<ErroresProducto>({})
  const [camara, setCamara] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const campoCodigo = useRef<HTMLInputElement>(null)
  const campoNombre = useRef<HTMLInputElement>(null)
  const base = useId()
  const idError = { nombre: `${base}-nombre`, dinero: `${base}-dinero`, control: `${base}-control`, stock: `${base}-stock` }
  /** Un campo con error queda inválido y apunta a su mensaje (3.3.1). */
  const enlace = (hayError: boolean, id: string) => (hayError ? { 'aria-invalid': true as const, 'aria-describedby': id } : {})
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  const usadas = [...new Set((productos ?? []).map((item) => item.categoria?.trim()).filter((item): item is string => Boolean(item)))]
  const categorias = [...new Set([...usadas, ...(usadas.length < 4 ? CATEGORIAS_SUGERIDAS : []), ...(categoria ? [categoria] : [])])]
    .sort((a, b) => a.localeCompare(b, 'es'))

  const codigoLimpio = codigo.trim()
  const yaExiste = codigoLimpio !== '' ? (productos ?? []).find((item) => item.codigoBarras === codigoLimpio && item.id !== producto?.id) : undefined
  const precioCentavos = pesosACentavos(pesosDeTexto(precio))
  const costoCentavos = pesosACentavos(pesosDeTexto(costo))
  const margen = precioCentavos > 0 && costoCentavos > 0 ? margenProducto({ precio: precioCentavos, costo: costoCentavos }) : null
  const porUnidad = unidad === 'unidad'
  const sufijo = unidad === 'kg' ? 'kg' : unidad === 'l' ? 'L' : 'unidades'
  const rotuloPrecio = unidad === 'kg' ? 'Precio por kilo' : unidad === 'l' ? 'Precio por litro' : 'Precio'

  async function guardar(seguir: boolean) {
    setAviso(null)
    try {
      const ofertaCentavos = precioOferta.trim() === '' ? undefined : pesosACentavos(pesosDeTexto(precioOferta))
      const fechaOferta = ofertaHasta ? new Date(`${ofertaHasta}T23:59:59`).getTime() : undefined
      const stockMinimo = minimo.trim() === '' ? 0 : leerCantidad(minimo)
      const stock = stockInicial.trim() === '' ? 0 : leerCantidad(stockInicial)
      const existentes = await repos.productos.todos()
      const nuevosErrores = validarProducto({
        nombre,
        costo: costoCentavos,
        precio: precioCentavos,
        codigoBarras: codigoLimpio || null,
        stockMinimo,
        unidad,
      }, existentes, producto?.id)
      const stockValido = Number.isFinite(stock) && stock >= 0 && (porUnidad ? Number.isInteger(stock) : redondearCantidad(stock) === stock)
      if (!producto && !stockValido) nuevosErrores.stockInicial = porUnidad ? 'Escribí cuántas unidades tenés (un número entero).' : `Escribí cuántos ${sufijo} tenés (por ejemplo 2,5).`
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
      const guardado = await repos.productos.guardar({
        ...(producto ?? {}),
        nombre: nombre.trim(),
        codigoBarras: codigoLimpio || null,
        costo: costoCentavos,
        precio: precioCentavos,
        stock: producto ? producto.stock : stock,
        stockMinimo,
        unidad,
        categoria: categoria.trim() || undefined,
        precioOferta: ofertaCentavos,
        ofertaHasta: ofertaCentavos ? fechaOferta : undefined,
      })
      onGuardado?.(guardado)
      if (!producto) {
        // Lista para el siguiente: se queda la categoría y cómo se vende.
        setNombre(''); setCosto(''); setPrecio(''); setPrecioOferta(''); setOfertaHasta(''); setCodigo(''); setStockInicial('')
        setErrores({})
        if (seguir) campoCodigo.current?.focus()
        else onTerminar?.()
      }
    } catch {
      setAviso(noSePudo('guardar', 'el producto'))
    } finally {
      setGuardando(false)
    }
  }

  function elegirCategoria(nueva: string) {
    setCategoria((actual) => (actual === nueva ? '' : nueva))
    setNuevaCategoria(null)
  }

  return (
    <form className="f-stock-form f-carga" onSubmit={(evento) => { evento.preventDefault(); void guardar(true) }}>
      <div className="f-carga-paso">
        <label className="f-campo">
          <span>Código de barras <em>opcional · pasalo con el lector o la cámara</em></span>
          <span className="f-carga-codigo">
            <input
              ref={campoCodigo}
              aria-label="Código de barras"
              inputMode="numeric"
              autoComplete="off"
              autoFocus={!producto && !codigoInicial}
              placeholder="Escaneá o escribí el código"
              className="f-entrada"
              value={codigo}
              {...enlace(Boolean(errores.codigoBarras), idError.control)}
              onChange={(evento) => { setCodigo(evento.target.value); setErrores((actuales) => ({ ...actuales, codigoBarras: undefined })) }}
              onKeyDown={(evento) => {
                // El lector termina con Enter: se pasa al nombre en vez de guardar.
                if (evento.key === 'Enter') { evento.preventDefault(); campoNombre.current?.focus() }
              }}
            />
            {escaner && (
              <button type="button" className="f-carga-camara" onClick={() => setCamara(true)} aria-label="Escanear el código con la cámara" title="Escanear con la cámara">
                <IconoEscanear />
              </button>
            )}
          </span>
          {yaExiste && <small className="f-stock-error" role="status">Este código ya es de <b>{yaExiste.nombre}</b>. Buscalo en el catálogo para editarlo.</small>}
          {errores.codigoBarras && <small id={idError.control} className="f-stock-error" role="alert">{errores.codigoBarras}</small>}
        </label>

        <label className="f-campo">
          <span>Nombre</span>
          <input
            ref={campoNombre}
            aria-label="Nombre"
            autoFocus={Boolean(codigoInicial) && !producto}
            placeholder="Ej. Yerba Playadito 1 kg"
            className="f-entrada"
            value={nombre}
            {...enlace(Boolean(errores.nombre), idError.nombre)}
            onChange={(evento) => { setNombre(evento.target.value); setErrores((actuales) => ({ ...actuales, nombre: undefined })); setAviso(null) }}
          />
          {errores.nombre && <small id={idError.nombre} className="f-stock-error" role="alert">{errores.nombre}</small>}
        </label>

        <div className="f-campo">
          <span id={`${base}-como`}>¿Cómo se vende?</span>
          <Segmentado etiqueta="Cómo se vende" opciones={COMO_SE_VENDE} valor={unidad} onCambiar={setUnidad} />
          {!porUnidad && (
            <small className="f-stock-ayuda">
              En Vender vas a poder pedir por {unidad === 'kg' ? 'peso ("medio kilo")' : 'cantidad ("medio litro")'} o por plata (&quot;dame $500&quot;).
            </small>
          )}
        </div>

        <div className="f-stock-fila-campos">
          <label className="f-campo">
            <span>{rotuloPrecio}</span>
            <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Precio" inputMode="decimal" placeholder="Ej. 1.200" className="f-entrada" value={precio} {...enlace(Boolean(errores.costo || errores.precio), idError.dinero)} onChange={(evento) => { setPrecio(evento.target.value); setErrores((actuales) => ({ ...actuales, precio: undefined })) }} /></div>
          </label>
          <label className="f-campo">
            <span>Te cuesta <em>opcional</em></span>
            <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Costo" inputMode="decimal" placeholder="Ej. 800" className="f-entrada" value={costo} {...enlace(Boolean(errores.costo || errores.precio), idError.dinero)} onChange={(evento) => { setCosto(evento.target.value); setErrores((actuales) => ({ ...actuales, costo: undefined })) }} /></div>
          </label>
        </div>
        {margen !== null && (
          <p className="f-carga-margen" data-tono={margen < 0 ? 'coral' : 'verde'}>
            {margen < 0 ? 'Lo vendés por debajo del costo.' : <>Ganás <b>{margen}%</b> ({formatearPesos(precioCentavos - costoCentavos)} {porUnidad ? 'por unidad' : unidad === 'kg' ? 'por kilo' : 'por litro'})</>}
          </p>
        )}
        {(errores.costo || errores.precio) && <p id={idError.dinero} className="f-stock-error" role="alert">{errores.costo ?? errores.precio}</p>}

        {!producto && (
          <label className="f-campo">
            <span>¿Cuántos tenés? <em>{sufijo}</em></span>
            <input aria-label="Stock inicial" inputMode={porUnidad ? 'numeric' : 'decimal'} placeholder={porUnidad ? 'Ej. 12' : 'Ej. 2,5'} className="f-entrada" value={stockInicial} {...enlace(Boolean(errores.stockInicial), idError.stock)} onChange={(evento) => { setStockInicial(evento.target.value); setErrores((actuales) => ({ ...actuales, stockInicial: undefined })) }} />
            {errores.stockInicial
              ? <small id={idError.stock} className="f-stock-error" role="alert">{errores.stockInicial}</small>
              : <small className="f-stock-ayuda">Si todavía no tenés, dejalo vacío.</small>}
          </label>
        )}

        <div className="f-campo">
          <span>Categoría <em>opcional</em></span>
          <div className="f-carga-categorias" role="group" aria-label="Categoría del producto">
            {categorias.map((opcion) => (
              <Chip key={opcion} activo={categoria === opcion} onClick={() => elegirCategoria(opcion)}>{opcion}</Chip>
            ))}
            {nuevaCategoria === null ? (
              <Chip activo={false} onClick={() => setNuevaCategoria('')}>+ Nueva</Chip>
            ) : (
              <input
                aria-label="Nueva categoría del producto"
                placeholder="Nombre y Enter"
                className="f-entrada f-carga-nueva"
                autoFocus
                value={nuevaCategoria}
                onChange={(evento) => setNuevaCategoria(evento.target.value)}
                onBlur={() => { if (nuevaCategoria.trim()) setCategoria(nuevaCategoria.trim()); setNuevaCategoria(null) }}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') { evento.preventDefault(); if (nuevaCategoria.trim()) setCategoria(nuevaCategoria.trim()); setNuevaCategoria(null) }
                  if (evento.key === 'Escape') { evento.stopPropagation(); setNuevaCategoria(null) }
                }}
              />
            )}
          </div>
        </div>

        <details className="f-carga-mas">
          <summary>Más opciones <span>mínimo para avisar y oferta</span></summary>
          <div className="f-carga-mas-cuerpo">
            <label className="f-campo">
              <span>Avisarme cuando queden <em>{sufijo}</em></span>
              <input aria-label="Mínimo" inputMode={porUnidad ? 'numeric' : 'decimal'} placeholder="3" className="f-entrada" value={minimo} {...enlace(Boolean(errores.stockMinimo), `${idError.control}-min`)} onChange={(evento) => { setMinimo(evento.target.value); setErrores((actuales) => ({ ...actuales, stockMinimo: undefined })) }} />
              {errores.stockMinimo && <small id={`${idError.control}-min`} className="f-stock-error" role="alert">{errores.stockMinimo}</small>}
            </label>
            <div className="f-stock-fila-campos">
              <label className="f-campo">
                <span>Precio de oferta</span>
                <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Oferta promocional" inputMode="decimal" placeholder="Ej. 1.050" className="f-entrada" value={precioOferta} onChange={(evento) => { setPrecioOferta(evento.target.value); setAviso(null) }} /></div>
              </label>
              <label className="f-campo">
                <span>Oferta válida hasta</span>
                <input aria-label="Fin de la oferta" type="date" className="f-entrada" value={ofertaHasta} onChange={(evento) => { setOfertaHasta(evento.target.value); setAviso(null) }} />
              </label>
            </div>
          </div>
        </details>
      </div>

      {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
      <div className="f-stock-acciones f-carga-acciones">
        {producto ? (
          <>
            <Boton variante="principal" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Boton>
            {onCancel && <Boton variante="secundario" type="button" onClick={onCancel}>Cancelar</Boton>}
          </>
        ) : (
          <>
            <Boton variante="principal" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar y cargar otro'}</Boton>
            <Boton variante="secundario" type="button" disabled={guardando} onClick={() => void guardar(false)}>Guardar producto y terminar</Boton>
          </>
        )}
      </div>

      {camara && (
        <VisorCamara
          titulo="Escaneá el código del producto"
          ayuda="Apuntá al código de barras con buena luz; se completa solo al leerlo."
          onCerrar={() => setCamara(false)}
          alLeer={(leido) => {
            setCodigo(leido)
            setCamara(false)
            window.setTimeout(() => campoNombre.current?.focus(), 50)
            return { tipo: 'ok', texto: `✓ Código ${leido}` }
          }}
        />
      )}

      {/* Para quien edita: lo que hay hoy, en la unidad elegida. */}
      {producto && <p className="f-stock-ayuda">Hoy hay {formatearCantidad(producto.stock, unidad)}{porUnidad ? ' unidades' : ''}. Para cambiarlo usá “Ajustar” en el catálogo.</p>}
    </form>
  )
}
