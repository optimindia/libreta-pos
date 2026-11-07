'use client'

import { useEffect, useMemo, useState } from 'react'
import { repos } from '@/datos/local/repos'
import { formatearCantidad, unidadDe } from '@/dominio/cantidad'
import { cantidadContada, productoPorCodigo, resumenConteo } from '@/dominio/conteo'
import { formatearPesos } from '@/dominio/dinero'
import type { Producto } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/validaciones'
import { Boton } from '@/ui/sistema/Boton'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoBuscar } from '@/ui/sistema/iconos'

/** El conteo a medio hacer queda guardado en este aparato: se puede contar
 *  una góndola hoy y otra mañana. */
const CLAVE = 'libreta.conteo'

function leerBorrador(): Record<string, string> {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    const valor = crudo ? (JSON.parse(crudo) as unknown) : null
    if (!valor || typeof valor !== 'object') return {}
    return Object.fromEntries(Object.entries(valor).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  } catch {
    return {}
  }
}

function guardarBorrador(textos: Record<string, string>) {
  try {
    if (Object.keys(textos).length === 0) window.localStorage.removeItem(CLAVE)
    else window.localStorage.setItem(CLAVE, JSON.stringify(textos))
  } catch { /* sin almacenamiento: sigue en pantalla */ }
}

type Mostrar = 'todos' | 'faltan' | 'diferencias'

export function ConteoInventario({ productos }: { productos: Producto[] }) {
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mostrar, setMostrar] = useState<Mostrar>('todos')
  const [revisando, setRevisando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resaltado, setResaltado] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el borrador vive en el aparato y se lee al montar
    setTextos(leerBorrador())
  }, [])

  function cambiar(id: string, texto: string) {
    const siguiente = { ...textos }
    if (texto === '') delete siguiente[id]
    else siguiente[id] = texto
    setTextos(siguiente)
    guardarBorrador(siguiente)
    setAviso(null)
  }

  const contados = useMemo(() => {
    const valores: Record<string, number> = {}
    for (const producto of productos) {
      const valor = cantidadContada(producto, textos[producto.id] ?? '')
      if (valor !== null) valores[producto.id] = valor
    }
    return valores
  }, [productos, textos])
  const resumen = resumenConteo(productos, contados)
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'es')), [productos])
  const aguja = normalizarTexto(busqueda)
  const visibles = productos
    .filter((p) => !categoria || p.categoria === categoria)
    .filter((p) => mostrar === 'todos' || (mostrar === 'faltan' ? contados[p.id] === undefined : resumen.conDiferencia.some((d) => d.producto.id === p.id)))
    .filter((p) => !aguja || normalizarTexto(`${p.nombre} ${p.codigoBarras ?? ''}`).includes(aguja))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const delGrupo = productos.filter((p) => !categoria || p.categoria === categoria)
  const contadosDelGrupo = delGrupo.filter((p) => contados[p.id] !== undefined).length

  function escanear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    const producto = productoPorCodigo(productos, busqueda)
    if (!producto) return
    evento.preventDefault()
    const actual = contados[producto.id] ?? 0
    cambiar(producto.id, String(actual + 1))
    setBusqueda('')
    setResaltado(producto.id)
  }

  async function aplicar() {
    setAplicando(true)
    let hechos = 0
    try {
      for (const diferencia of resumen.conDiferencia) {
        const listo = await repos.productos.ajustarStock(diferencia.producto.id, diferencia.diferencia)
        if (listo) hechos += 1
      }
      setTextos({})
      guardarBorrador({})
      setRevisando(false)
      setAviso(hechos === 0 ? 'Conteo cerrado: no había diferencias.' : `Listo: se corrigió el stock de ${hechos} ${hechos === 1 ? 'producto' : 'productos'}.`)
    } catch {
      setAviso('No se pudo corregir todo el stock. Revisá y probá de nuevo.')
    } finally {
      setAplicando(false)
    }
  }

  if (productos.length === 0) {
    return <EstadoVacio titulo="No hay productos para contar" texto="Cargá productos en el catálogo y después contalos acá." />
  }

  return (
    <div className="f-conteo">
      <Tarjeta como="section" className="f-conteo-cabeza" aria-labelledby="conteo-titulo">
        <div className="f-conteo-titulos">
          <div>
            <h2 id="conteo-titulo" className="f-seccion">Contar el stock</h2>
            <p className="f-dato">Anotá lo que hay en la góndola. Podés escanear: cada pasada suma uno. Lo contado queda guardado en este aparato hasta que lo cierres.</p>
          </div>
          <div className="f-conteo-avance" role="status">
            <strong className="tabular">{contadosDelGrupo} de {delGrupo.length}</strong>
            <span>contados</span>
          </div>
        </div>
        <div className="f-conteo-barra" aria-hidden="true"><span style={{ width: `${delGrupo.length ? Math.round((contadosDelGrupo / delGrupo.length) * 100) : 0}%` }} /></div>
        <label className="f-conteo-buscar">
          <IconoBuscar />
          <span className="f-sr">Buscar o escanear producto para contar</span>
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Buscá o escaneá un código"
            value={busqueda}
            onChange={(evento) => { setBusqueda(evento.target.value); setResaltado(null) }}
            onKeyDown={escanear}
          />
        </label>
        <Chips etiqueta="Qué productos mostrar">
          <Chip activo={mostrar === 'todos'} onClick={() => setMostrar('todos')}>Todos</Chip>
          <Chip activo={mostrar === 'faltan'} onClick={() => setMostrar('faltan')}>Sin contar ({delGrupo.length - contadosDelGrupo})</Chip>
          <Chip activo={mostrar === 'diferencias'} onClick={() => setMostrar('diferencias')}>Con diferencia ({resumen.conDiferencia.length})</Chip>
        </Chips>
        {categorias.length > 0 && (
          <select aria-label="Contar una categoría" className="f-entrada f-conteo-categoria" value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </Tarjeta>

      {aviso && <p className="f-aviso" data-tono="verde" role="status">{aviso}</p>}

      {visibles.length === 0 ? (
        <EstadoVacio compacto titulo="No hay productos en esta lista" texto={mostrar === 'diferencias' ? 'Todo lo contado coincide con el sistema.' : 'Probá con otra búsqueda.'} />
      ) : (
        <Tarjeta como="ul" relleno="ninguno" className="f-conteo-lista" aria-label="Productos para contar">
          {visibles.map((producto) => {
            const texto = textos[producto.id] ?? ''
            const contado = contados[producto.id]
            const invalido = texto !== '' && contado === undefined
            const diferencia = contado === undefined ? null : Math.round((contado - producto.stock) * 1000) / 1000
            const unidad = unidadDe(producto)
            return (
              <li key={producto.id} data-resaltado={resaltado === producto.id ? 'true' : undefined}>
                <span className="f-conteo-producto">
                  <strong>{producto.nombre}</strong>
                  <span>Sistema: {formatearCantidad(producto.stock, unidad)}</span>
                </span>
                <span className="f-conteo-dif" data-tono={diferencia === null ? undefined : diferencia === 0 ? 'verde' : diferencia < 0 ? 'coral' : 'ambar'}>
                  {invalido ? 'Revisá' : diferencia === null ? '' : diferencia === 0 ? 'Coincide' : `${diferencia > 0 ? '+' : '−'}${formatearCantidad(Math.abs(diferencia), unidad)}`}
                </span>
                <input
                  aria-label={`Contado de ${producto.nombre}`}
                  aria-invalid={invalido || undefined}
                  inputMode={unidad === 'unidad' ? 'numeric' : 'decimal'}
                  className="f-entrada f-conteo-cantidad tabular"
                  placeholder="—"
                  value={texto}
                  onChange={(evento) => cambiar(producto.id, evento.target.value)}
                />
              </li>
            )
          })}
        </Tarjeta>
      )}

      <div className="f-conteo-pie">
        <span className="f-dato">
          {resumen.contados === 0 ? 'Todavía no contaste nada.' : resumen.conDiferencia.length === 0 ? `${resumen.contados} contados, todo coincide.` : `${resumen.conDiferencia.length} con diferencia · faltan ${formatearPesos(resumen.faltante)} a costo${resumen.sobrante > 0 ? ` · sobran ${formatearPesos(resumen.sobrante)}` : ''}`}
        </span>
        <Boton variante="principal" tamano="grande" disabled={resumen.contados === 0} onClick={() => setRevisando(true)}>Revisar y cerrar conteo</Boton>
      </div>

      <Hoja abierta={revisando} onCerrar={() => { if (!aplicando) setRevisando(false) }} titulo="Cerrar el conteo" ancho="angosto">
        {resumen.conDiferencia.length === 0 ? (
          <p className="f-hoja-ayuda">Contaste {resumen.contados} {resumen.contados === 1 ? 'producto' : 'productos'} y todo coincide con el sistema. No hay que corregir nada.</p>
        ) : (
          <>
            <p className="f-hoja-ayuda">El stock de estos productos se va a corregir a lo que contaste. Queda anotado como ajuste.</p>
            <ul className="f-conteo-revision">
              {resumen.conDiferencia.map((d) => (
                <li key={d.producto.id}>
                  <span><strong>{d.producto.nombre}</strong><span>{formatearCantidad(d.esperado, unidadDe(d.producto))} → {formatearCantidad(d.contado, unidadDe(d.producto))}</span></span>
                  <span className="f-conteo-dif" data-tono={d.diferencia < 0 ? 'coral' : 'ambar'}>{d.valor < 0 ? '−' : '+'}{formatearPesos(Math.abs(d.valor))}</span>
                </li>
              ))}
            </ul>
            <p className="f-conteo-total"><span>Faltante a costo</span><strong>{formatearPesos(resumen.faltante)}</strong></p>
          </>
        )}
        <Boton variante="principal" tamano="grande" ancho disabled={aplicando} onClick={() => void aplicar()}>
          {aplicando ? 'Corrigiendo…' : resumen.conDiferencia.length === 0 ? 'Cerrar conteo' : `Corregir ${resumen.conDiferencia.length} ${resumen.conDiferencia.length === 1 ? 'producto' : 'productos'}`}
        </Boton>
      </Hoja>
    </div>
  )
}
