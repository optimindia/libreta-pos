'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { formatearPesos } from '@/dominio/dinero'
import { desgloseDelDia, etiquetaVendedor } from '@/dominio/turno'
import { repos } from '@/datos/local/repos'
import type { Identidad } from '@/ui/sistema/usoVendedor'

/** El día del dueño vendedor por vendedor: cuánto vendió cada uno, cuánto
 *  efectivo le corresponde y cómo le fue al cerrar su turno. Sólo lectura:
 *  no hay botones, el cierre del día sigue en "Cerrar caja". */
export function CierrePorVendedor({ yo }: { yo: Identidad }) {
  const filas = useLiveQuery(async () => {
    const [ventas, pagos, turnos] = await Promise.all([
      repos.ventas.todas(), repos.fiados.pagos(), repos.cierres.turnos(),
    ])
    return desgloseDelDia(ventas, pagos, turnos, Date.now())
  }, [])

  if (!filas || filas.length === 0) return null

  return (
    <section className="fp-vendedores" aria-label="Hoy por vendedor">
      <h3 className="fp-subtitulo">Hoy, por vendedor</h3>
      <ul className="fp-lista">
        {filas.map((fila) => {
          const cierre = fila.cierre
          const detalle = `${fila.cantidadVentas} ${fila.cantidadVentas === 1 ? 'venta' : 'ventas'} · efectivo ${formatearPesos(fila.efectivo)}`
          return (
            <li key={fila.vendedor} className="f-renglon">
              <span className="f-renglon-cuerpo">
                <span className="f-renglon-titulo">{etiquetaVendedor(fila.vendedor, yo)}</span>
                <span className="f-renglon-detalle">
                  {detalle} · {cierre === null ? 'Sin cerrar' : cierre.diferencia === 0 ? 'Cuadró' : `${cierre.diferencia < 0 ? 'Faltó' : 'Sobró'} ${formatearPesos(Math.abs(cierre.diferencia))}`}
                </span>
              </span>
              <span className="f-renglon-fin" data-tono={cierre === null ? undefined : cierre.diferencia < 0 ? 'ambar' : 'verde'}>{formatearPesos(fila.vendido)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
