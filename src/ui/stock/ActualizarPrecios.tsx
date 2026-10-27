'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { UUID } from '@/dominio/tipos'
import { cambiosPorMargen, cambiosPorPorcentaje, type CambioPrecio } from '@/dominio/precios'
import { repos } from '@/datos/local/repos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { IconoPorcentaje } from '@/ui/sistema/iconos'

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
    <form className="form-shell form-card price-update-form" onSubmit={(evento) => void aplicar(evento)}>
      <div className="form-intro">
        <span className="form-intro-icon" aria-hidden="true"><IconoPorcentaje /></span>
        <div><strong>Actualizá varios precios</strong><p>Elegí una regla, revisá la vista previa y confirmá cuando todo esté bien.</p></div>
      </div>
      <section className="form-section">
        <div className="form-section-heading">
          <span className="form-step">1</span>
          <div><h3>Elegí cómo calcular</h3><p>Podés aumentar el precio actual o partir del costo.</p></div>
        </div>
      <div className="price-mode-grid">
        <Boton
          type="button"
          variante={modo === 'porcentaje' ? 'principal' : 'secundario'}
          className="price-mode-button !py-2 !text-[12px]"
          aria-pressed={modo === 'porcentaje'}
          onClick={() => setModo('porcentaje')}
        >
          <strong>Precio actual</strong><small>Sumar un porcentaje</small>
        </Boton>
        <Boton
          type="button"
          variante={modo === 'margen' ? 'principal' : 'secundario'}
          className="price-mode-button !py-2 !text-[12px]"
          aria-pressed={modo === 'margen'}
          onClick={() => setModo('margen')}
        >
          <strong>Desde el costo</strong><small>Definir margen</small>
        </Boton>
      </div>
      </section>

      {listo !== null && (
        <p className="form-message form-message-success" role="status">
          Listo: se actualizaron {listo} precios.
        </p>
      )}

      <section className="form-section">
        <div className="form-section-heading">
          <span className="form-step">2</span>
          <div><h3>Definí el porcentaje</h3><p>{modo === 'porcentaje' ? 'Se suma al precio que ya tiene cada producto.' : 'Se calcula como porcentaje sobre el costo cargado.'}</p></div>
        </div>
        <label className="form-field">
          <span className="form-field-label">{modo === 'porcentaje' ? 'Aumento sobre el precio' : 'Margen sobre el costo'} <em>porcentaje</em></span>
          <div className="form-input-with-suffix"><input aria-label={modo === 'porcentaje' ? 'Porcentaje de aumento' : 'Margen sobre el costo'} inputMode="decimal" placeholder="Ej. 10" className="form-input form-input-large tabular" value={modo === 'porcentaje' ? porcentaje : margen} onChange={(evento) => { setListo(null); setAviso(null); if (modo === 'porcentaje') setPorcentaje(evento.target.value); else setMargen(evento.target.value) }} /><span aria-hidden="true">%</span></div>
          <span className="form-field-help">Usá números enteros o decimales. La vista previa te muestra el resultado antes de guardar.</span>
        </label>
      </section>

      {sinCostos ? (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--tenue)' }}>
          Todavía no cargaste costos: subí una factura del mayorista y volvé.
        </p>
      ) : candidatos.length === 0 ? (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--tenue)' }}>
          Con ese número no cambia ningún precio.
        </p>
      ) : !expandido ? (
        <Boton
          type="button"
          variante="secundario"
          className="w-full"
          onClick={() => setExpandido(true)}
        >
          Ver los {candidatos.length} precios que cambian · vista previa
        </Boton>
      ) : (
        <>
          <section className="form-section price-preview-section">
            <div className="form-section-heading">
              <span className="form-step">3</span>
              <div><h3>Revisá antes de aplicar</h3><p>Los tachados quedan con su precio actual.</p></div>
            </div>
          <ul className="price-preview-list">
            {candidatos.map(({ producto, precioActual, precioNuevo }) => {
              const fuera = desmarcados.has(producto.id)
              return (
              <li key={producto.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 text-left"
                  style={{ borderBottom: '1px solid var(--linea)', opacity: fuera ? 0.45 : 1 }}
                  onClick={() => alternar(producto.id)}
                >
                  <span className="text-[13px] font-medium">{producto.nombre}</span>
                  <span className="tabular flex items-baseline gap-1.5 text-[13px]">
                    <span style={{ color: 'var(--tenue)', textDecoration: 'line-through' }}>
                      {formatear(precioActual)}
                    </span>
                    <Importe centavos={precioNuevo} tamaño="chico" />
                  </span>
                </button>
              </li>
              )
            })}
          </ul>
          <p className="form-field-help price-preview-help">
            Tocá un producto para dejarlo como está.
          </p>
          </section>
          <Boton type="submit" variante="principal" disabled={aplicando || cambios.length === 0}>
            {aplicando ? 'Actualizando…' : `Actualizar ${cambios.length} precios`}
          </Boton>
          {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
        </>
      )}
    </form>
  )
}

function formatear(centavos: number) {
  return <Importe centavos={centavos} tamaño="chico" />
}
