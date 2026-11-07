'use client'

import { useState } from 'react'
import { formatearPesos } from '@/dominio/dinero'
import { resumenHistorial, variacion } from '@/dominio/historialPrecios'
import type { Producto } from '@/dominio/tipos'

const DIA_MES = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const CON_ANIO = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

/** "5 nov", o "5 nov 2025" si no es de este año. */
function fechaCorta(epoch: number, anioActual: number): string {
  const fecha = new Date(epoch)
  return (fecha.getFullYear() === anioActual ? DIA_MES : CON_ANIO).format(fecha).replace(/ de /g, ' ').replace('.', '')
}

function textoVariacion(valor: number | null): string {
  if (valor === null || valor === 0) return ''
  return `${valor > 0 ? '+' : '−'}${Math.abs(valor).toLocaleString('es-AR')}%`
}

/** Cómo fue cambiando el precio (y el costo, para el dueño). */
export function HistorialPrecios({ producto, verCosto }: { producto: Producto; verCosto: boolean }) {
  const [todos, setTodos] = useState(false)
  const [anio] = useState(() => new Date().getFullYear())
  const { cambios, primero, subioDesdeElPrimero } = resumenHistorial(producto)
  if (cambios.length < 2 || !primero) return null
  const recientes = [...cambios].reverse()
  const visibles = todos ? recientes : recientes.slice(0, 5)
  return (
    <section className="f-precios-historial" aria-labelledby={`historial-${producto.id}`}>
      <div className="f-precios-historial-cabeza">
        <h3 id={`historial-${producto.id}`} className="f-hoja-subtitulo">Historial de precios</h3>
        {subioDesdeElPrimero !== null && subioDesdeElPrimero !== 0 && (
          <span className="f-precios-historial-total" data-sube={subioDesdeElPrimero > 0 ? 'true' : 'false'}>
            {textoVariacion(subioDesdeElPrimero)} desde el {fechaCorta(primero.fecha, anio)}
          </span>
        )}
      </div>
      <ol className="f-precios-historial-lista">
        {visibles.map((cambio, indice) => {
          const anterior = recientes[indice + 1]
          const cambioPrecio = anterior ? variacion(anterior.precio, cambio.precio) : null
          return (
            <li key={`${cambio.fecha}-${indice}`}>
              <span className="f-precios-historial-fecha">{fechaCorta(cambio.fecha, anio)}</span>
              <span className="f-precios-historial-valores">
                <strong className="f-plata">{formatearPesos(cambio.precio)}</strong>
                {verCosto && <span>costo {formatearPesos(cambio.costo)}</span>}
              </span>
              <span className="f-precios-historial-var" data-sube={cambioPrecio !== null && cambioPrecio > 0 ? 'true' : 'false'}>
                {anterior ? textoVariacion(cambioPrecio) || 'igual' : 'inicial'}
              </span>
            </li>
          )
        })}
      </ol>
      {recientes.length > 5 && (
        <button type="button" className="f-precios-historial-mas" onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : `Ver los ${recientes.length} cambios`}
        </button>
      )}
    </section>
  )
}
