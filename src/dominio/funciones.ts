/**
 * Funciones que cada negocio puede mostrar u ocultar.
 *
 * La configuración pertenece al negocio, no al aparato: una vez que se
 * sincroniza, todos los dispositivos reciben el mismo mapa de funciones.
 */
export const CLAVES_FUNCION = [
  'vender',
  'pedidos',
  'fiados',
  'stock',
  'plata',
  'clientes',
  'historial',
  'controlPro',
  'escanerVenta',
  'escanerStock',
  'importarFactura',
  'importarCatalogo',
  'respaldoLocal',
  'atajosPc',
  'cuenta',
  'configuracion',
] as const

export type ClaveFuncion = (typeof CLAVES_FUNCION)[number]
export type FuncionesNegocio = Record<ClaveFuncion, boolean>
export type GrupoFuncion = 'Módulos' | 'Herramientas' | 'Productividad'

export interface DefinicionFuncion {
  clave: ClaveFuncion
  titulo: string
  descripcion: string
  grupo: GrupoFuncion
  fija?: boolean
}

export const DEFINICIONES_FUNCION: readonly DefinicionFuncion[] = [
  { clave: 'vender', titulo: 'Ventas', descripcion: 'El mostrador para armar tickets y cobrar.', grupo: 'Módulos', fija: true },
  { clave: 'pedidos', titulo: 'Pedidos', descripcion: 'Encargos, entregas y reservas de stock.', grupo: 'Módulos' },
  { clave: 'fiados', titulo: 'Fiados', descripcion: 'Cuentas corrientes, vencimientos y pagos.', grupo: 'Módulos' },
  { clave: 'stock', titulo: 'Stock', descripcion: 'Catálogo, existencias, costos y precios.', grupo: 'Módulos' },
  { clave: 'plata', titulo: 'Plata y caja', descripcion: 'Ganancia, movimientos y cierres.', grupo: 'Módulos' },
  { clave: 'clientes', titulo: 'Clientes', descripcion: 'Cartera, historial y contacto por WhatsApp.', grupo: 'Módulos' },
  { clave: 'historial', titulo: 'Historial', descripcion: 'Auditoría y comprobantes de ventas.', grupo: 'Módulos' },
  { clave: 'controlPro', titulo: 'Control Pro', descripcion: 'Métricas, alertas y decisiones operativas.', grupo: 'Módulos' },
  { clave: 'escanerVenta', titulo: 'Escáner para vender', descripcion: 'Lector físico y cámara para sumar al ticket.', grupo: 'Herramientas' },
  { clave: 'escanerStock', titulo: 'Escáner para cargar stock', descripcion: 'Leer un código y completar un producto nuevo.', grupo: 'Herramientas' },
  { clave: 'importarFactura', titulo: 'Lectura de facturas', descripcion: 'Reconocer una factura con una foto y revisar sus datos.', grupo: 'Herramientas' },
  { clave: 'importarCatalogo', titulo: 'Importar y exportar catálogo', descripcion: 'Mover productos mediante archivos CSV.', grupo: 'Herramientas' },
  { clave: 'respaldoLocal', titulo: 'Copias de seguridad', descripcion: 'Guardar y restaurar una copia del negocio.', grupo: 'Herramientas' },
  { clave: 'atajosPc', titulo: 'Atajos de teclado', descripcion: 'Buscar y cobrar más rápido desde una PC.', grupo: 'Productividad' },
  { clave: 'cuenta', titulo: 'Cuenta y suscripción', descripcion: 'Consultar el estado y el acceso del negocio.', grupo: 'Productividad', fija: true },
  { clave: 'configuracion', titulo: 'Configuración', descripcion: 'Administrar identidad, funciones y dispositivo.', grupo: 'Productividad', fija: true },
] as const

export const FUNCIONES_POR_DEFECTO: FuncionesNegocio = Object.fromEntries(
  CLAVES_FUNCION.map((clave) => [clave, true]),
) as FuncionesNegocio

function esMapa(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Completa valores faltantes para que una función nueva no rompa negocios
 * existentes y descarta claves desconocidas que no deben llegar a la UI. */
export function normalizarFunciones(valor: unknown): FuncionesNegocio {
  const entrada = esMapa(valor) ? valor : {}
  const resultado = CLAVES_FUNCION.reduce((acumulado, clave) => {
    acumulado[clave] = typeof entrada[clave] === 'boolean'
      ? entrada[clave]
      : FUNCIONES_POR_DEFECTO[clave]
    return acumulado
  }, { ...FUNCIONES_POR_DEFECTO })
  for (const definicion of DEFINICIONES_FUNCION) {
    if (definicion.fija) resultado[definicion.clave] = true
  }
  return resultado
}

export function funcionActiva(
  funciones: Partial<FuncionesNegocio> | undefined,
  clave: ClaveFuncion,
): boolean {
  return esFuncionFija(clave) || funciones?.[clave] !== false
}

export function esFuncionFija(clave: ClaveFuncion): boolean {
  return DEFINICIONES_FUNCION.some((definicion) => definicion.clave === clave && definicion.fija)
}

/** No permite apagar ventas, cuenta ni configuración: el negocio siempre
 * conserva un camino para operar y volver a cambiar sus preferencias. */
export function cambiarFuncion(
  funciones: Partial<FuncionesNegocio> | undefined,
  clave: ClaveFuncion,
  activa: boolean,
): FuncionesNegocio {
  const normalizadas = normalizarFunciones(funciones)
  if (!activa && esFuncionFija(clave)) return normalizadas
  return { ...normalizadas, [clave]: activa }
}

export function cantidadFuncionesActivas(funciones: Partial<FuncionesNegocio> | undefined): number {
  return CLAVES_FUNCION.filter((clave) => funcionActiva(funciones, clave)).length
}

export function definicionesPorGrupo(grupo: GrupoFuncion): readonly DefinicionFuncion[] {
  return DEFINICIONES_FUNCION.filter((definicion) => definicion.grupo === grupo)
}
