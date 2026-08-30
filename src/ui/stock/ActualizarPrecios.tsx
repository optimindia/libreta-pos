'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { UUID } from '@/dominio/tipos'
import { cambiosPorMargen, cambiosPorPorcentaje, type CambioPrecio } from '@/dominio/precios'
import { repos } from '@/datos/local/repos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

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

  async function aplicar() {
    if (cambios.length === 0 || aplicando) return
    setAplicando(true)
    for (const cambio of cambios) {
      await repos.productos.guardar({ ...cambio.producto, precio: cambio.precioNuevo })
    }
    setDesmarcados(new Set())
    setListo(cambios.length)
    setExpandido(false)
    setAplicando(false)
  }

  const sinCostos = modo === 'margen' && (productos ?? []).length > 0 &&
    (productos ?? []).every((p) => p.costo === 0)

  return (
    <div>
      <div className="flex gap-2">
        <Boton
          variante={modo === 'porcentaje' ? 'principal' : 'secundario'}
          className="flex-1 !py-2 !text-[12px]"
          onClick={() => setModo('porcentaje')}
        >
          Por porcentaje
        </Boton>
        <Boton
          variante={modo === 'margen' ? 'principal' : 'secundario'}
          className="flex-1 !py-2 !text-[12px]"
          onClick={() => setModo('margen')}
        >
          Desde el costo
        </Boton>
      </div>

      {listo !== null && (
        <p className="mt-3 rounded-xl px-3.5 py-3 text-[13px]" style={{ background: 'var(--chip-fondo)', color: 'var(--verde)' }}>
          Listo: se actualizaron {listo} precios.
        </p>
      )}

      <label className="mt-3 block text-[12px]" style={{ color: 'var(--tenue)' }}>
        {modo === 'porcentaje'
          ? '¿Cuánto suben los precios? (%)'
          : '¿Cuánto querés ganar sobre el costo? (%)'}
        <input
          aria-label={modo === 'porcentaje' ? 'Porcentaje de aumento' : 'Margen sobre el costo'}
          inputMode="decimal"
          className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[15px]"
          style={campo}
          value={modo === 'porcentaje' ? porcentaje : margen}
          onChange={(evento) => {
            setListo(null)
            if (modo === 'porcentaje') setPorcentaje(evento.target.value)
            else setMargen(evento.target.value)
          }}
        />
      </label>

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
          variante="secundario"
          className="mt-3 w-full"
          onClick={() => setExpandido(true)}
        >
          Ver los {candidatos.length} precios que cambian
        </Boton>
      ) : (
        <>
          <ul className="mt-3">
            {candidatos.map(({ producto, precioActual, precioNuevo }) => {
              const fuera = desmarcados.has(producto.id)
              return (
              <li key={producto.id}>
                <button
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

          <Boton
            variante="principal"
            className="mt-4 w-full"
            disabled={aplicando || cambios.length === 0}
            onClick={aplicar}
          >
            {aplicando ? 'Actualizando…' : `Actualizar ${cambios.length} precios`}
          </Boton>
          <p className="mt-2 text-[11.5px]" style={{ color: 'var(--tenue)' }}>
            Tocá un producto para dejarlo como está.
          </p>
        </>
      )}
    </div>
  )
}

function formatear(centavos: number) {
  return <Importe centavos={centavos} tamaño="chico" />
}