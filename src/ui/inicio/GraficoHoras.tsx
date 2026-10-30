'use client'

import { useState } from 'react'
import { formatearPesos } from '@/dominio/dinero'
import { alturasDeBarras, mejorFranja, type DetalleFranja } from '@/dominio/inicio'

const cantidadDeVentas = (cantidad: number) => `${cantidad} ${cantidad === 1 ? 'venta' : 'ventas'}`

/** Lo vendido hoy, hora por hora. Cada barra se puede tocar, recorrer con el
 *  teclado o señalar con el cursor: sube, muestra su horario, la plata y
 *  cuántas ventas fueron, y la línea de abajo lo dice en palabras. */
export function GraficoHoras({ franjas }: { franjas: DetalleFranja[] }) {
  const [activa, setActiva] = useState<number | null>(null)
  const alturas = alturasDeBarras(franjas.map((franja) => franja.monto))
  const mejor = mejorFranja(franjas.map((franja) => franja.monto))

  const lectura = (franja: DetalleFranja) =>
    franja.cantidad === 0 ? `${franja.etiqueta} · sin ventas` : `${franja.etiqueta} · ${formatearPesos(franja.monto)} · ${cantidadDeVentas(franja.cantidad)}`

  const lineaDeAbajo =
    activa !== null
      ? lectura(franjas[activa])
      : mejor === null
        ? 'Cuando vendas, acá ves a qué hora se vende más'
        : `Tu mejor horario: ${franjas[mejor].etiqueta}`

  return (
    <div className="fi-grafico" onMouseLeave={() => setActiva(null)}>
      <div className="fi-barras" role="group" aria-label="Ventas de hoy por horario">
        {franjas.map((franja, i) => (
          <button
            key={franja.desde}
            type="button"
            className="fi-barra-boton"
            data-fuerte={i === mejor ? 'true' : undefined}
            data-activa={i === activa ? 'true' : undefined}
            aria-label={lectura(franja)}
            style={{ '--alto': `${alturas[i]}%` } as React.CSSProperties}
            onMouseEnter={() => setActiva(i)}
            onFocus={() => setActiva(i)}
            onBlur={() => setActiva((actual) => (actual === i ? null : actual))}
            onClick={() => setActiva(i)}
          >
            <span className="fi-barra-globo" aria-hidden="true">
              <strong>{franja.cantidad === 0 ? 'Sin ventas' : formatearPesos(franja.monto)}</strong>
              <small>{franja.etiqueta}{franja.cantidad > 0 ? ` · ${cantidadDeVentas(franja.cantidad)}` : ''}</small>
            </span>
            <span className="fi-barra" />
          </button>
        ))}
      </div>
      <div className="fi-horas" aria-hidden="true">
        {franjas.map((franja) => <span key={franja.desde}>{franja.desde}</span>)}
      </div>
      <p className="fi-grafico-lectura f-texto">{lineaDeAbajo}</p>
    </div>
  )
}
