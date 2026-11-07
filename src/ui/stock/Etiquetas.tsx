'use client'

import './etiquetas.css'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatearPesos } from '@/dominio/dinero'
import {
  etiquetaDe,
  hojasNecesarias,
  POR_HOJA,
  productosParaEtiquetas,
  type CriterioEtiquetas,
  type Etiqueta,
  type TamanoEtiqueta,
} from '@/dominio/etiquetas'
import type { Producto } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/validaciones'
import { Boton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

const SEMANA = 7 * 86_400_000

function TarjetaEtiqueta({ etiqueta, tamano }: { etiqueta: Etiqueta; tamano: TamanoEtiqueta }) {
  return (
    <div className="f-gondola" data-formato={tamano} data-oferta={etiqueta.antes !== null ? 'true' : undefined}>
      {etiqueta.antes !== null && <span className="f-gondola-oferta">Oferta</span>}
      <span className="f-gondola-nombre">{etiqueta.nombre}</span>
      <span className="f-gondola-precio">
        {etiqueta.antes !== null && <s>{formatearPesos(etiqueta.antes)}</s>}
        <strong>{formatearPesos(etiqueta.precio)}</strong>
        {etiqueta.medida && <em>{etiqueta.medida}</em>}
      </span>
      {etiqueta.codigo && <span className="f-gondola-codigo">{etiqueta.codigo}</span>}
    </div>
  )
}

/** Etiquetas de góndola en hoja A4: las de los precios que cambiaron, las
 *  ofertas o las que se elijan. */
export function Etiquetas({ productos }: { productos: Producto[] }) {
  const [ahora] = useState(() => Date.now())
  const [criterio, setCriterio] = useState<CriterioEtiquetas>('cambiados')
  const [tamano, setTamano] = useState<TamanoEtiqueta>('chica')
  const [busqueda, setBusqueda] = useState('')
  const [quitados, setQuitados] = useState<Set<string>>(() => new Set())
  const [imprimiendo, setImprimiendo] = useState(0)

  const cuentas = useMemo(() => ({
    cambiados: productosParaEtiquetas(productos, 'cambiados', ahora - SEMANA, ahora).length,
    oferta: productosParaEtiquetas(productos, 'oferta', ahora - SEMANA, ahora).length,
    todos: productosParaEtiquetas(productos, 'todos', ahora - SEMANA, ahora).length,
  }), [productos, ahora])
  const candidatos = useMemo(() => productosParaEtiquetas(productos, criterio, ahora - SEMANA, ahora), [productos, criterio, ahora])
  const aguja = normalizarTexto(busqueda)
  const visibles = aguja === '' ? candidatos : candidatos.filter((producto) => normalizarTexto(`${producto.nombre} ${producto.codigoBarras ?? ''}`).includes(aguja))
  const elegidos = candidatos.filter((producto) => !quitados.has(producto.id))
  const etiquetas = elegidos.map((producto) => etiquetaDe(producto, ahora))
  const hojas = hojasNecesarias(etiquetas.length, tamano)

  useEffect(() => {
    if (imprimiendo > 0) window.print()
  }, [imprimiendo])

  function alternar(id: string) {
    const siguiente = new Set(quitados)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    setQuitados(siguiente)
  }

  function elegirCriterio(nuevo: CriterioEtiquetas) {
    setCriterio(nuevo)
    setQuitados(new Set())
  }

  return (
    <div className="f-etiquetas">
      <Tarjeta como="section" className="f-etiquetas-panel" aria-labelledby="etiquetas-titulo">
        <div>
          <h2 id="etiquetas-titulo" className="f-seccion">Etiquetas de góndola</h2>
          <p className="f-dato">Imprimilas en una hoja A4, recortalas y ponelas en el estante.</p>
        </div>
        <Chips etiqueta="Qué etiquetas imprimir">
          <Chip activo={criterio === 'cambiados'} onClick={() => elegirCriterio('cambiados')}>Cambiaron esta semana ({cuentas.cambiados})</Chip>
          <Chip activo={criterio === 'oferta'} onClick={() => elegirCriterio('oferta')}>En oferta ({cuentas.oferta})</Chip>
          <Chip activo={criterio === 'todos'} onClick={() => elegirCriterio('todos')}>Todos ({cuentas.todos})</Chip>
        </Chips>
        <div className="f-etiquetas-tamano" role="radiogroup" aria-label="Tamaño de las etiquetas">
          {(['chica', 'grande'] as const).map((opcion) => (
            <button key={opcion} type="button" role="radio" aria-checked={tamano === opcion} onClick={() => setTamano(opcion)}>
              <strong>{opcion === 'chica' ? 'Chicas' : 'Grandes'}</strong>
              <span>{POR_HOJA[opcion]} por hoja</span>
            </button>
          ))}
        </div>

        {candidatos.length === 0 ? (
          <EstadoVacio
            compacto
            titulo={criterio === 'cambiados' ? 'Ningún precio cambió esta semana' : criterio === 'oferta' ? 'No hay ofertas vigentes' : 'No hay productos con precio'}
            texto={criterio === 'todos' ? 'Cargá precios en el catálogo para poder imprimir etiquetas.' : 'Probá con "Todos" para elegir a mano.'}
          />
        ) : (
          <>
            {candidatos.length > 8 && <CampoBusqueda etiqueta="Buscar producto para etiquetas" placeholder="Buscar producto" valor={busqueda} onCambiar={setBusqueda} />}
            <div className="f-etiquetas-acciones-lista">
              <span className="f-dato">{elegidos.length} de {candidatos.length} elegidos</span>
              <button type="button" className="f-etiquetas-todos" onClick={() => setQuitados(elegidos.length === candidatos.length ? new Set(candidatos.map((p) => p.id)) : new Set())}>
                {elegidos.length === candidatos.length ? 'Quitar todos' : 'Elegir todos'}
              </button>
            </div>
            <ul className="f-etiquetas-lista">
              {visibles.map((producto) => (
                <li key={producto.id}>
                  <label>
                    <input type="checkbox" checked={!quitados.has(producto.id)} onChange={() => alternar(producto.id)} />
                    <span className="f-etiquetas-lista-nombre">{producto.nombre}</span>
                    <span className="f-plata">{formatearPesos(etiquetaDe(producto, ahora).precio)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Boton variante="principal" tamano="grande" ancho disabled={etiquetas.length === 0} onClick={() => setImprimiendo((n) => n + 1)}>
              Imprimir {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}{etiquetas.length > 0 ? ` · ${hojas} ${hojas === 1 ? 'hoja' : 'hojas'}` : ''}
            </Boton>
          </>
        )}
      </Tarjeta>

      {etiquetas.length > 0 && (
        <section className="f-etiquetas-vista" aria-label="Así salen las etiquetas">
          <h3 className="f-hoja-subtitulo">Así salen</h3>
          <div className="f-etiquetas-grilla" data-formato={tamano}>
            {etiquetas.slice(0, POR_HOJA[tamano]).map((etiqueta) => <TarjetaEtiqueta key={etiqueta.id} etiqueta={etiqueta} tamano={tamano} />)}
          </div>
          {etiquetas.length > POR_HOJA[tamano] && <p className="f-dato">Y {etiquetas.length - POR_HOJA[tamano]} más en las hojas siguientes.</p>}
        </section>
      )}

      {imprimiendo > 0 && createPortal(
        <div className="f-etiquetas-impresas" aria-hidden="true">
          <style>{'@page { size: A4; margin: 8mm; }'}</style>
          <div className="f-etiquetas-grilla" data-formato={tamano}>
            {etiquetas.map((etiqueta) => <TarjetaEtiqueta key={etiqueta.id} etiqueta={etiqueta} tamano={tamano} />)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
