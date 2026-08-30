import type { Centavos, UUID, Venta } from './tipos'

const DIA_EN_MS = 24 * 60 * 60 * 1000
const MESES_DE_GRACIA = 12

export interface FilaResumen {
  dia: string
  productoId: UUID
  unidades: number
  vendido: Centavos
  ganancia: Centavos
}

function claveDelDia(fecha: number): string {
  return new Date(fecha).toISOString().slice(0, 10)
}

/** El almacenero no necesita el ticket exacto de un martes de hace dos años;
 *  necesita saber cuánto vendió. Esto es lo que queda cuando se tira el detalle. */
export function resumirVentas(ventas: Venta[]): FilaResumen[] {
  const filas = new Map<string, FilaResumen>()

  for (const venta of ventas) {
    const dia = claveDelDia(venta.fecha)
    for (const item of venta.items) {
      const clave = `${dia}|${item.productoId}`
      const vendido = item.precio * item.cantidad
      const ganancia = (item.precio - item.costo) * item.cantidad
      const fila = filas.get(clave)
      if (fila) {
        fila.unidades += item.cantidad
        fila.vendido += vendido
        fila.ganancia += ganancia
      } else {
        filas.set(clave, {
          dia,
          productoId: item.productoId,
          unidades: item.cantidad,
          vendido,
          ganancia,
        })
      }
    }
  }

  return [...filas.values()]
}

export function ventasAArchivar(
  ventas: Venta[],
  ahora: number,
  mesesDeGracia: number = MESES_DE_GRACIA,
): Venta[] {
  const corte = ahora - mesesDeGracia * 30 * DIA_EN_MS
  return ventas.filter((venta) => venta.fecha < corte)
}
