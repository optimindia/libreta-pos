import type { IdSeccion } from './menu'

/** Quién atiende: el dueño ve todo; un vendedor vende, fía y mira stock,
 *  pero no las ganancias, la configuración ni el Centro Pro. */
export type Rol = 'dueno' | 'vendedor'

const SECCIONES_SOLO_DUENO: ReadonlySet<IdSeccion> = new Set(['plata', 'config', 'operacion'])
const RUTAS_SOLO_DUENO = ['/plata', '/config', '/operacion'] as const

/** Lo que no se reconoce cuenta como dueño: así un negocio que todavía no
 *  bajó su rol (o uno sólo local) no pierde nada. */
export function rolDe(valor: unknown): Rol {
  return valor === 'vendedor' ? 'vendedor' : 'dueno'
}

export function seccionPermitida(rol: Rol, id: IdSeccion): boolean {
  return rol === 'dueno' || !SECCIONES_SOLO_DUENO.has(id)
}

export function rutaPermitida(rol: Rol, ruta: string): boolean {
  if (rol === 'dueno') return true
  return !RUTAS_SOLO_DUENO.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))
}

/** Lo que la base (RLS y triggers de 20261028140000_permisos_vendedor.sql)
 *  le rechaza a un vendedor. La app no se lo ofrece, así nada queda trabado
 *  en la cola esperando un permiso que no va a llegar. */
export const ACCIONES_SOLO_DUENO = [
  'editarProductos', // alta, ficha (nombre, precio, costo…) y borrado
  'ajustarStock',
  'cargarMercaderia',
  'anularVentas',
  'borrarClientes',
] as const
export type AccionSoloDueno = (typeof ACCIONES_SOLO_DUENO)[number]

export function puede(rol: Rol, accion: AccionSoloDueno): boolean {
  return rol === 'dueno' || !ACCIONES_SOLO_DUENO.includes(accion)
}
