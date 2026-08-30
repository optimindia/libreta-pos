import type { Centavos, MedioPago, Venta } from './tipos'
import { multiplicar, sumar } from './dinero'

export interface ResumenDia {
  vendido: Centavos
  ganancia: Centavos
  cantidadVentas: number
  porMedioPago: Record<MedioPago, Centavos>
}

export function gananciaVenta(venta: Venta): Centavos {
  return sumar(
    ...venta.items.map((item) =>
      multiplicar(item.precio - item.costo, item.cantidad),
    ),
  )
}

function esMismoDia(fecha: number, dia: Date): boolean {
  const f = new Date(fecha)
  return (
    f.getFullYear() === dia.getFullYear() &&
    f.getMonth() === dia.getMonth() &&
    f.getDate() === dia.getDate()
  )
}

export function resumenDelDia(ventas: Venta[], dia: Date): ResumenDia {
  const delDia = ventas.filter((venta) => esMismoDia(venta.fecha, dia))
  const porMedioPago: Record<MedioPago, Centavos> = {
    efectivo: 0, transferencia: 0, qr: 0, fiado: 0,
  }
  for (const venta of delDia) {
    porMedioPago[venta.medioPago] += venta.total
  }
  return {
    vendido: sumar(...delDia.map((venta) => venta.total)),
    ganancia: sumar(...delDia.map(gananciaVenta)),
    cantidadVentas: delDia.length,
    porMedioPago,
  }
}
