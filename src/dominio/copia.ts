// Copia de seguridad completa del negocio: formato, validación y plan de
// fusión. Puro: lo único que sabe de Dexie es el número de esquema. La cola
// de sincronización NUNCA forma parte de una copia ni de una restauración:
// es estado propio de cada aparato y copiarla duplicaría o perdería envíos.

/** Versión del formato del archivo. La 1 era la copia sin número de esquema. */
export const VERSION_COPIA = 2
/** Última versión de las tablas de Dexie (db.version en datos/local/db.ts). */
export const ESQUEMA_ACTUAL = 6

export const TABLAS_DATOS = [
  'productos', 'ventas', 'clientes', 'fiados', 'fiadoPagos', 'ingresos', 'cierres', 'movimientosCaja', 'pedidos',
] as const
export type TablaDatos = (typeof TABLAS_DATOS)[number]

export interface Fila {
  id: string
  [campo: string]: unknown
}

export interface Copia {
  version: number
  /** Ausente en las copias de versión 1. */
  esquema?: number
  creadoEn: number
  productos: Fila[]
  ventas: Fila[]
  clientes: Fila[]
  fiados: Fila[]
  fiadoPagos: Fila[]
  ingresos: Fila[]
  cierres: Fila[]
  negocio: Fila[]
  /** Opcionales: las copias anteriores no los traían. */
  movimientosCaja?: Fila[]
  pedidos?: Fila[]
  preferencias?: Fila[]
}

export type MotivoRechazo = 'corrupto' | 'version-futura' | 'invalida'

export type ResultadoCopia =
  | { ok: true; copia: Copia }
  | { ok: false; motivo: MotivoRechazo; detalle: string }

type Regla = (fila: Record<string, unknown>) => boolean

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const txt = (v: unknown) => typeof v === 'string'
const lista = (v: unknown) => Array.isArray(v)

/** Campos que, si están rotos, rompen la pantalla o la plata. No se exige
 *  todo: una copia vieja puede no traer campos opcionales. */
const REGLAS: Record<TablaDatos | 'negocio' | 'preferencias', Regla> = {
  productos: (f) => txt(f.nombre) && num(f.precio) && num(f.costo) && num(f.stock),
  ventas: (f) => num(f.fecha) && num(f.total) && lista(f.items),
  clientes: (f) => txt(f.nombre),
  fiados: (f) => txt(f.clienteId) && num(f.monto) && num(f.fecha),
  fiadoPagos: (f) => txt(f.fiadoId) && num(f.monto),
  ingresos: (f) => num(f.fecha) && lista(f.items),
  cierres: (f) => num(f.fecha),
  movimientosCaja: (f) => num(f.fecha) && num(f.monto),
  pedidos: (f) => num(f.fecha) && lista(f.items),
  preferencias: () => true,
  negocio: (f) => txt(f.nombre),
}

const OBLIGATORIAS = ['productos', 'ventas', 'clientes', 'fiados', 'fiadoPagos', 'ingresos', 'cierres', 'negocio'] as const
const OPCIONALES = ['movimientosCaja', 'pedidos', 'preferencias'] as const

const rechazo = (motivo: MotivoRechazo, detalle: string): ResultadoCopia => ({ ok: false, motivo, detalle })

function validarTabla(nombre: keyof typeof REGLAS, valor: unknown): string | null {
  if (!Array.isArray(valor)) return `"${nombre}" no es una lista`
  const vistos = new Set<string>()
  for (const fila of valor) {
    if (typeof fila !== 'object' || fila === null || Array.isArray(fila)) return `"${nombre}" tiene una fila inválida`
    const registro = fila as Record<string, unknown>
    if (!txt(registro.id) || registro.id === '') return `"${nombre}" tiene una fila sin id`
    if (vistos.has(registro.id as string)) return `"${nombre}" repite el id ${registro.id as string}`
    vistos.add(registro.id as string)
    if (!REGLAS[nombre](registro)) return `"${nombre}" tiene datos dañados (id ${registro.id as string})`
  }
  return null
}

/** Lee el texto de un archivo y decide si es una copia que esta app puede
 *  restaurar. Nunca lanza: el motivo le sirve a la pantalla para explicar. */
export function interpretarCopia(texto: string): ResultadoCopia {
  let valor: unknown
  try {
    valor = JSON.parse(texto.replace(/^﻿/, ''))
  } catch {
    return rechazo('corrupto', 'El archivo no es un JSON legible.')
  }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return rechazo('corrupto', 'El archivo no tiene el formato de una copia.')
  }
  return validarCopiaObjeto(valor)
}

/** Igual que interpretarCopia pero para un valor ya parseado. */
export function validarCopiaObjeto(valor: unknown): ResultadoCopia {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return rechazo('corrupto', 'El archivo no tiene el formato de una copia.')
  }
  const c = valor as Record<string, unknown>
  if (!Number.isInteger(c.version) || (c.version as number) < 1 || !num(c.creadoEn)) {
    return rechazo('corrupto', 'Faltan los datos de identificación de la copia.')
  }
  if ((c.version as number) > VERSION_COPIA) {
    return rechazo('version-futura', 'La copia la hizo una versión más nueva de Libreta.')
  }
  if (c.esquema !== undefined) {
    if (!Number.isInteger(c.esquema) || (c.esquema as number) < 1) return rechazo('corrupto', 'El esquema de la copia es inválido.')
    if ((c.esquema as number) > ESQUEMA_ACTUAL) {
      return rechazo('version-futura', 'La copia usa una estructura de datos más nueva que esta versión de Libreta.')
    }
  }
  for (const tabla of OBLIGATORIAS) {
    const error = validarTabla(tabla, c[tabla])
    if (error) return rechazo('invalida', error)
  }
  for (const tabla of OPCIONALES) {
    if (c[tabla] === undefined) continue
    const error = validarTabla(tabla, c[tabla])
    if (error) return rechazo('invalida', error)
  }
  return { ok: true, copia: c as unknown as Copia }
}

const TITULOS: Record<TablaDatos, string> = {
  productos: 'Productos', ventas: 'Ventas', clientes: 'Clientes', fiados: 'Fiados',
  fiadoPagos: 'Pagos de fiados', ingresos: 'Ingresos de mercadería', cierres: 'Cierres de caja',
  movimientosCaja: 'Movimientos de caja', pedidos: 'Pedidos',
}

export interface FilaResumen { tabla: TablaDatos; titulo: string; cantidad: number }

export function resumirCopia(copia: Copia): FilaResumen[] {
  return TABLAS_DATOS.map((tabla) => ({ tabla, titulo: TITULOS[tabla], cantidad: copia[tabla]?.length ?? 0 }))
}

export interface PlanTabla {
  agregar: Fila[]
  actualizar: Fila[]
  /** Ids que ya estaban y se dejan como están. */
  conservar: string[]
  /** Sólo con reemplazo explícito: ids del aparato que la copia no tiene. */
  borrar: string[]
}
export interface PlanFusion {
  tablas: Record<TablaDatos, PlanTabla>
}

export type FilasActuales = Partial<Record<TablaDatos, { id: string; actualizadoEn?: number }[]>>

/** Fusiona por id. Lo nuevo se agrega; lo que ya existe se pisa sólo si la
 *  copia es claramente más reciente (ambos con `actualizadoEn`). Sin marca de
 *  tiempo gana lo que ya está en el aparato: una venta anulada hoy no vuelve
 *  a "completada" por restaurar una copia de ayer. Sólo con `reemplazar`
 *  se borra lo que la copia no trae. */
export function planificarFusion(copia: Copia, actual: FilasActuales, opciones: { reemplazar?: boolean } = {}): PlanFusion {
  const tablas = {} as Record<TablaDatos, PlanTabla>
  for (const tabla of TABLAS_DATOS) {
    const existentes = new Map((actual[tabla] ?? []).map((f) => [f.id, f]))
    const plan: PlanTabla = { agregar: [], actualizar: [], conservar: [], borrar: [] }
    const idsCopia = new Set<string>()
    for (const fila of copia[tabla] ?? []) {
      idsCopia.add(fila.id)
      const previa = existentes.get(fila.id)
      if (!previa) plan.agregar.push(fila)
      else if (num(fila.actualizadoEn) && num(previa.actualizadoEn) && (fila.actualizadoEn as number) > (previa.actualizadoEn as number)) plan.actualizar.push(fila)
      else plan.conservar.push(fila.id)
    }
    if (opciones.reemplazar) plan.borrar = [...existentes.keys()].filter((id) => !idsCopia.has(id))
    tablas[tabla] = plan
  }
  return { tablas }
}

export function totalAfectado(plan: PlanFusion): { agregados: number; actualizados: number; conservados: number; borrados: number } {
  const resultado = { agregados: 0, actualizados: 0, conservados: 0, borrados: 0 }
  for (const tabla of TABLAS_DATOS) {
    const p = plan.tablas[tabla]
    resultado.agregados += p.agregar.length
    resultado.actualizados += p.actualizar.length
    resultado.conservados += p.conservar.length
    resultado.borrados += p.borrar.length
  }
  return resultado
}
