'use client'

import { useState } from 'react'
import { alturasDeBarras } from '@/dominio/inicio'
import {
  AYUDA_VISTA, barrasDe, mejorBarraDeVista, resumenDeBarras, TITULO_VISTA, type VistaVentas,
} from '@/dominio/tendencia'
import type { Venta } from '@/dominio/tipos'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoHora } from '@/ui/sistema/iconos'

const VISTAS: { id: VistaVentas; etiqueta: string; nombre: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy', nombre: 'Hoy por horario' },
  { id: 'dias', etiqueta: 'Últimos 7 días', nombre: 'Últimos siete días' },
  { id: 'semana', etiqueta: 'Día de la semana', nombre: 'Día de la semana' },
  { id: 'meses', etiqueta: 'Por mes', nombre: 'Por mes' },
]

/** Lo vendido, en cuatro miradas: hoy por horario, los últimos siete días,
 *  qué día de la semana vende más y cómo viene mes a mes. Cada barra se
 *  puede tocar, recorrer con el teclado o señalar con el cursor. */
export function GraficoVentas({ ventas, ahora }: { ventas: Venta[]; ahora: Date }) {
  const [vista, setVista] = useState<VistaVentas>('hoy')
  const [activa, setActiva] = useState<number | null>(null)
  const barras = barrasDe(vista, ventas, ahora)
  const alturas = alturasDeBarras(barras.map((barra) => barra.monto))
  const mejor = mejorBarraDeVista(vista, barras)
  const linea = activa !== null ? barras[activa].lectura : resumenDeBarras(vista, barras)

  function elegir(nueva: VistaVentas) {
    setVista(nueva)
    setActiva(null)
  }

  return (
    <Tarjeta como="section" className="fi-horario" aria-labelledby="fi-horario-titulo">
      <div className="fi-bloque-cabeza">
        <span className="fi-bloque-icono" data-tono="verde"><IconoHora /></span>
        <div>
          <h2 id="fi-horario-titulo" className="f-seccion">{TITULO_VISTA[vista]}</h2>
          <p className="fi-bloque-ayuda">{AYUDA_VISTA[vista]}</p>
        </div>
      </div>

      <Chips etiqueta="Qué ver de tus ventas" className="fi-vistas">
        {VISTAS.map((opcion) => (
          <Chip key={opcion.id} activo={vista === opcion.id} onClick={() => elegir(opcion.id)}>{opcion.etiqueta}</Chip>
        ))}
      </Chips>

      <div className="fi-grafico" onMouseLeave={() => setActiva(null)}>
        <div className="fi-barras" role="group" aria-label={`Ventas: ${VISTAS.find((v) => v.id === vista)?.nombre}`} data-cantidad={barras.length}>
          {barras.map((barra, i) => (
            <button
              key={barra.clave}
              type="button"
              className="fi-barra-boton"
              data-fuerte={i === mejor ? 'true' : undefined}
              data-activa={i === activa ? 'true' : undefined}
              aria-label={barra.lectura}
              style={{ '--alto': `${alturas[i]}%`, '--i': i } as React.CSSProperties}
              onMouseEnter={() => setActiva(i)}
              onFocus={() => setActiva(i)}
              onBlur={() => setActiva((actual) => (actual === i ? null : actual))}
              onClick={() => setActiva(i)}
            >
              <span className="fi-barra-globo" aria-hidden="true">
                <strong>{barra.valor}</strong>
                <small>{barra.detalle ? `${barra.titulo} · ${barra.detalle}` : barra.titulo}</small>
              </span>
              <span className="fi-barra" />
            </button>
          ))}
        </div>
        <div className="fi-horas" aria-hidden="true" data-cantidad={barras.length}>
          {barras.map((barra) => <span key={barra.clave}>{barra.rotulo}</span>)}
        </div>
        <p className="fi-grafico-lectura f-texto">{linea}</p>
      </div>
    </Tarjeta>
  )
}
