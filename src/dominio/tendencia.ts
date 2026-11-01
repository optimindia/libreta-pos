import type { Centavos, Venta } from './tipos'
import { detalleFranjas } from './inicio'
import { formatearPesos } from './dinero'

/** Cómo se mira lo vendido: hoy por horario, los últimos días, qué día de la
 *  semana vende más, o cómo viene mes a mes. */
export type VistaVentas = 'hoy' | 'dias' | 'semana' | 'meses'

export interface BarraVentas {
  clave: string
  /** Lo que se escribe debajo de la barra (corto). */
  rotulo: string
  /** Nombre completo: sale al señalar la barra. */
  titulo: string
  monto: Centavos
  cantidad: number
  /** Lo que se muestra en el globo al señalarla (la plata). */
  valor: string
  /** Un dato más debajo del valor (por ejemplo, cuántas ventas). */
  detalle: string
  /** La frase completa, para lectores de pantalla y la línea de abajo. */
  lectura: string
}

export const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] as const
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

/** Lunes = 0, domingo = 6. */
const indiceDeDia = (fecha: Date) => (fecha.getDay() + 6) % 7

const cantidadDeVentas = (cantidad: number) => `${cantidad} ${cantidad === 1 ? 'venta' : 'ventas'}`

/** Fecha sin hora, en el horario del aparato. Usar el constructor con día
 *  corrido evita errores con cambios de horario. */
function diaDe(fecha: Date, desplazamiento = 0): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + desplazamiento)
}

const claveDia = (dia: Date) => `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}`
const claveMes = (dia: Date) => `${dia.getFullYear()}-${dia.getMonth()}`

function sumarPor(ventas: Venta[], clave: (fecha: Date) => string): Map<string, { monto: Centavos; cantidad: number }> {
  const totales = new Map<string, { monto: Centavos; cantidad: number }>()
  for (const venta of ventas) {
    if (venta.estado === 'anulada') continue
    const k = clave(new Date(venta.fecha))
    const actual = totales.get(k) ?? { monto: 0, cantidad: 0 }
    totales.set(k, { monto: actual.monto + venta.total, cantidad: actual.cantidad + 1 })
  }
  return totales
}

function barra(partes: Omit<BarraVentas, 'valor' | 'detalle' | 'lectura'> & { detalle?: string }): BarraVentas {
  const sinVentas = partes.cantidad === 0
  const valor = sinVentas ? 'Sin ventas' : formatearPesos(partes.monto)
  const detalle = partes.detalle ?? (sinVentas ? '' : cantidadDeVentas(partes.cantidad))
  const lectura = sinVentas
    ? `${partes.titulo} · sin ventas`
    : `${partes.titulo} · ${formatearPesos(partes.monto)} · ${cantidadDeVentas(partes.cantidad)}`
  return { ...partes, valor, detalle, lectura }
}

/** Hoy, de a dos horas (de 6 a 22). Lo que ya existía, en la forma común. */
export function barrasDeHoy(ventas: Venta[], ahora: Date): BarraVentas[] {
  return detalleFranjas(ventas, ahora).map((franja) => barra({
    clave: `${franja.desde}`,
    rotulo: `${franja.desde}`,
    titulo: franja.etiqueta,
    monto: franja.monto,
    cantidad: franja.cantidad,
  }))
}

/** Los últimos siete días, el de hoy al final. */
export function barrasDeLosUltimosDias(ventas: Venta[], ahora: Date, dias = 7): BarraVentas[] {
  const totales = sumarPor(ventas, (fecha) => claveDia(diaDe(fecha)))
  return Array.from({ length: dias }, (_, i) => {
    const dia = diaDe(ahora, i - (dias - 1))
    const total = totales.get(claveDia(dia)) ?? { monto: 0, cantidad: 0 }
    const nombre = NOMBRES_DIAS[indiceDeDia(dia)]
    return barra({
      clave: claveDia(dia),
      rotulo: DIAS_CORTOS[indiceDeDia(dia)],
      titulo: `${nombre} ${dia.getDate()} de ${MESES[dia.getMonth()].toLowerCase()}`,
      monto: total.monto,
      cantidad: total.cantidad,
    })
  })
}

/** Qué día de la semana vende más: el promedio por día de cada día de la
 *  semana, sobre las últimas semanas. Si la cuenta es nueva, sólo cuenta los
 *  días desde la primera venta, así el promedio no sale chico. */
export function barrasDePromedioPorDiaDeLaSemana(ventas: Venta[], ahora: Date, semanas = 8): BarraVentas[] {
  const validas = ventas.filter((venta) => venta.estado !== 'anulada')
  const hoy = diaDe(ahora)
  const inicioVentana = diaDe(ahora, -(semanas * 7 - 1))
  const primera = validas.length > 0 ? diaDe(new Date(Math.min(...validas.map((venta) => venta.fecha)))) : hoy
  const desde = primera > inicioVentana ? primera : inicioVentana

  const dias = Array.from({ length: 7 }, () => 0)
  for (let dia = desde; dia <= hoy; dia = diaDe(dia, 1)) dias[indiceDeDia(dia)] += 1

  const montos = Array.from({ length: 7 }, () => 0)
  const cantidades = Array.from({ length: 7 }, () => 0)
  for (const venta of validas) {
    const dia = diaDe(new Date(venta.fecha))
    if (dia < inicioVentana || dia > hoy) continue
    montos[indiceDeDia(dia)] += venta.total
    cantidades[indiceDeDia(dia)] += 1
  }

  return NOMBRES_DIAS.map((nombre, i) => {
    const ocurrencias = Math.max(1, dias[i])
    const promedio = Math.round(montos[i] / ocurrencias)
    return barra({
      clave: `${i}`,
      rotulo: DIAS_CORTOS[i],
      titulo: nombre,
      monto: promedio,
      cantidad: cantidades[i],
      detalle: cantidades[i] === 0
        ? `ningún ${nombre.toLowerCase()} con ventas`
        : `por día · ${ocurrencias} ${ocurrencias === 1 ? nombre.toLowerCase() : nombre.toLowerCase() + 's'} contados`,
    })
  })
}

/** Los últimos meses, el actual al final. */
export function barrasDeLosMeses(ventas: Venta[], ahora: Date, meses = 12): BarraVentas[] {
  const totales = sumarPor(ventas, (fecha) => claveMes(fecha))
  return Array.from({ length: meses }, (_, i) => {
    const mes = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1 - i), 1)
    const total = totales.get(claveMes(mes)) ?? { monto: 0, cantidad: 0 }
    return barra({
      clave: claveMes(mes),
      rotulo: MESES_CORTOS[mes.getMonth()],
      titulo: `${MESES[mes.getMonth()]} ${mes.getFullYear()}`,
      monto: total.monto,
      cantidad: total.cantidad,
    })
  })
}

export function barrasDe(vista: VistaVentas, ventas: Venta[], ahora: Date): BarraVentas[] {
  if (vista === 'dias') return barrasDeLosUltimosDias(ventas, ahora)
  if (vista === 'semana') return barrasDePromedioPorDiaDeLaSemana(ventas, ahora)
  if (vista === 'meses') return barrasDeLosMeses(ventas, ahora)
  return barrasDeHoy(ventas, ahora)
}

/** Posición de la barra más alta, o null si no se vendió nada en la vista. */
export function mejorBarra(barras: BarraVentas[]): number | null {
  const mayor = Math.max(0, ...barras.map((item) => item.monto))
  return mayor === 0 ? null : barras.findIndex((item) => item.monto === mayor)
}

/** La frase de abajo del gráfico: cuál fue lo mejor, en palabras. */
export function resumenDeBarras(vista: VistaVentas, barras: BarraVentas[]): string {
  const mejor = mejorBarra(barras)
  if (vista === 'hoy') {
    return mejor === null
      ? 'Cuando vendas, acá ves a qué hora se vende más'
      : `Tu mejor horario: ${barras[mejor].titulo}`
  }
  if (vista === 'dias') {
    if (mejor === null) return 'Acá ves cuánto vendiste en los últimos siete días'
    return `Tu día más fuerte: ${barras[mejor].titulo} · ${formatearPesos(barras[mejor].monto)}`
  }
  if (vista === 'semana') {
    if (mejor === null) return 'Cuando tengas unas semanas de ventas, acá ves qué día vendés más'
    const promedioGeneral = barras.reduce((total, item) => total + item.monto, 0) / barras.length
    const sobre = promedioGeneral > 0 ? Math.round((barras[mejor].monto / promedioGeneral - 1) * 100) : 0
    const nombre = barras[mejor].titulo.toLowerCase()
    const extra = sobre >= 5 ? `, un ${sobre}% más que el promedio de la semana` : ''
    return `Tu mejor día es el ${nombre}: ${formatearPesos(barras[mejor].monto)} por día${extra}`
  }
  // meses: sólo cuentan los meses cerrados. El mes en curso recién empezó y
  // compararlo con uno entero da una caída que no existe.
  const cerrados = barras.slice(0, -1)
  const mejorCerrado = mejorBarra(cerrados)
  if (mejorCerrado === null) return 'Cuando cierre un mes con ventas, acá ves cuál fue tu mejor mes'
  const mejorMes = cerrados[mejorCerrado]
  const ultimo = cerrados[cerrados.length - 1]
  const previo = cerrados[cerrados.length - 2]
  let tendencia = ''
  if (ultimo && previo && previo.monto > 0 && ultimo.monto > 0) {
    const variacion = Math.round((ultimo.monto / previo.monto - 1) * 100)
    if (Math.abs(variacion) >= 5) {
      const mes = ultimo.titulo.split(' ')[0]
      const antes = previo.titulo.split(' ')[0]
      tendencia = ` · ${mes} va ${variacion > 0 ? `${variacion}% arriba` : `${-variacion}% abajo`} de ${antes}`
    }
  }
  return `Mejor mes: ${mejorMes.titulo} (${formatearPesos(mejorMes.monto)})${tendencia}`
}

/** En "por mes" el mejor mes se elige entre los cerrados. */
export function mejorBarraDeVista(vista: VistaVentas, barras: BarraVentas[]): number | null {
  return vista === 'meses' ? mejorBarra(barras.slice(0, -1)) : mejorBarra(barras)
}

export const TITULO_VISTA: Record<VistaVentas, string> = {
  hoy: 'Ventas de hoy por horario',
  dias: 'Últimos siete días',
  semana: 'Día de la semana',
  meses: 'Ventas por mes',
}

export const AYUDA_VISTA: Record<VistaVentas, string> = {
  hoy: 'Pasá el cursor o tocá una barra para ver cuánto vendiste en ese horario.',
  dias: 'Cada barra es un día. Tocá una para ver cuánto vendiste.',
  semana: 'Cuánto vendés en promedio cada día de la semana.',
  meses: 'Cuánto vendiste en cada uno de los últimos doce meses.',
}
