'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { UUID } from '@/dominio/tipos'
import { cambiosPorMargen, cambiosPorPorcentaje, type CambioPrecio } from '@/dominio/precios'
import { repos } from '@/datos/local/repos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { Chip } from '@/ui/sistema/Chip'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'

type Modo = 'porcentaje' | 'margen'

/** Cambia muchos precios de una vez, con vista previa: el almacenero
 *  siempre ve y confirma antes de que se toque un solo precio. */
export function ActualizarPrecios() {
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  const [modo, setModo] = useState<Modo>('porcentaje')
  const [porcentaje, setPorcentaje] = useState('10')
  const [margen, setMargen] = useState('25')
  const [desmarcados, setDesmarcados] = useState<Set<UUID>>(new Set())
  const [expandido, setExpandido] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [listo, setListo] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const candidatos: CambioPrecio[] =
    productos === undefined
      ? []
      : modo === 'porcentaje'
        ? cambiosPorPorcentaje(productos, Number(porcentaje) || 0)
        : cambiosPorMargen(productos, Number(margen) || 0)
  const cambios = candidatos.filter(({ producto }) => !desmarcados.has(producto.id))

  function alternar(id: UUID) {
    setDesmarcados((actuales) => {
      const nuevos = new Set(actuales)
      if (nuevos.has(id)) nuevos.delete(id)
      else nuevos.add(id)
      return nuevos
    })
  }

  async function aplicar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    if (cambios.length === 0 || aplicando) return
    const valor = Number(modo === 'porcentaje' ? porcentaje : margen)
    if (!Number.isFinite(valor) || valor < 0) {
      setAviso('Usá un porcentaje igual o mayor a cero.')
      return
    }
    setAplicando(true)
    setAviso(null)
    try {
      for (const cambio of cambios) {
        await repos.productos.guardar({ ...cambio.producto, precio: cambio.precioNuevo })
      }
      setDesmarcados(new Set())
      setListo(cambios.length)
      setExpandido(false)
    } catch {
      setAviso('No se pudieron actualizar los precios. Probá de nuevo.')
    } finally {
      setAplicando(false)
    }
  }

  const sinCostos = modo === 'margen' && (productos ?? []).length > 0 &&
    (productos ?? []).every((p) => p.costo === 0)

  return (
    <form className="f-tarjeta f-stock-form" data-relleno="normal" onSubmit={(evento) => void aplicar(evento)}>
      <div>
        <h2 className="f-seccion">Actualizá varios precios</h2>
        <p className="f-dato">Elegí una regla, revisá la vista previa y confirmá cuando todo esté bien.</p>
      </div>
      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Cómo calcular</h3>
        <div className="f-stock-modos">
          <Chip type="button" className="f-stock-modo" activo={modo === 'porcentaje'} onClick={() => setModo('porcentaje')}>
            <strong>Precio actual</strong><small>Sumar un porcentaje</small>
          </Chip>
          <Chip type="button" className="f-stock-modo" activo={modo === 'margen'} onClick={() => setModo('margen')}>
            <strong>Desde el costo</strong><small>Definir margen</small>
          </Chip>
        </div>
      </section>

      {listo !== null && (
        <p className="f-aviso f-stock-ok" role="status">
          Listo: se actualizaron {listo} precios.
        </p>
      )}

      <section className="f-stock-grupo">
        <h3 className="f-stock-grupo-titulo">Cuánto</h3>
        <label className="f-campo">
          <span>{modo === 'porcentaje' ? 'Aumento sobre el precio' : 'Margen sobre el costo'} <em>porcentaje</em></span>
          <div className="f-stock-prefijo f-stock-sufijo"><input aria-label={modo === 'porcentaje' ? 'Porcentaje de aumento' : 'Margen sobre el costo'} inputMode="decimal" placeholder="Ej. 10" className="f-entrada" value={modo === 'porcentaje' ? porcentaje : margen} onChange={(evento) => { setListo(null); setAviso(null); if (modo === 'porcentaje') setPorcentaje(evento.target.value); else setMargen(evento.target.value) }} /><span aria-hidden="true">%</span></div>
          <small className="f-stock-ayuda">{modo === 'porcentaje' ? 'Se suma al precio que ya tiene cada producto.' : 'Se calcula como porcentaje sobre el costo cargado.'} La vista previa te muestra el resultado antes de guardar.</small>
        </label>
      </section>

      {sinCostos ? (
        <EstadoVacio compacto titulo="Todavía no cargaste costos" texto="Subí una factura del mayorista y después volvé para actualizar los precios." />
      ) : candidatos.length === 0 ? (
        <p className="f-dato">
          Con ese número no cambia ningún precio.
        </p>
      ) : !expandido ? (
        <Boton
          type="button"
          variante="secundario"
          ancho
          onClick={() => setExpandido(true)}
        >
          Ver los {candidatos.length} precios que cambian · vista previa
        </Boton>
      ) : (
        <>
          <section className="f-stock-grupo">
            <h3 className="f-stock-grupo-titulo">Revisá antes de aplicar</h3>
            <p className="f-stock-ayuda">Tocá un producto para dejarlo como está.</p>
            <ul className="f-stock-previa">
              {candidatos.map(({ producto, precioActual, precioNuevo }) => {
                const fuera = desmarcados.has(producto.id)
                return (
                  <li key={producto.id}>
                    <button
                      type="button"
                      className="f-stock-previa-renglon"
                      data-fuera={fuera ? 'true' : undefined}
                      onClick={() => alternar(producto.id)}
                    >
                      <span className="f-renglon-titulo">{producto.nombre}</span>
                      <span className="f-stock-previa-precios">
                        <span className="f-stock-tachado">{formatear(precioActual)}</span>
                        <Importe centavos={precioNuevo} tamaño="chico" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
          {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
          <Boton type="submit" variante="principal" ancho disabled={aplicando || cambios.length === 0}>
            {aplicando ? 'Actualizando…' : `Actualizar ${cambios.length} ${cambios.length === 1 ? 'precio' : 'precios'}`}
          </Boton>
        </>
      )}
    </form>
  )
}

function formatear(centavos: number) {
  return <Importe centavos={centavos} tamaño="chico" />
}
