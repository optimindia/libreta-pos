import { cliente } from './cliente'

export type EstadoAdmin = 'prueba' | 'activa' | 'gracia' | 'suspendida' | 'vencida' | 'sin_suscripcion'
export type TipoPlan = 'prueba' | 'pago' | 'cortesia'
export type MedioPagoAdmin = 'alias' | 'efectivo' | 'transferencia' | 'mercado_pago' | 'otro'

export interface AdminPlan {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  tipo: TipoPlan
  dias: number
  precioCentavos: number
  activo: boolean
  orden: number
  creadoEn: string
  actualizadoEn: string
}

export interface AdminSuscripcion {
  id: string
  negocioId: string
  planId: string | null
  planNombre: string | null
  importeCentavos: number
  estado: 'prueba' | 'activa' | 'gracia' | 'suspendida'
  estadoEfectivo: EstadoAdmin
  tipo: 'prueba' | 'mensual' | 'cortesia' | 'manual'
  inicioEn: string
  venceEn: string
  graciaHasta: string | null
  nota: string | null
  actualizadoEn: string
  diasRestantes: number
}

export interface AdminCuenta {
  id: string
  nombre: string
  telefono: string | null
  notaInterna: string | null
  creadoEn: string
  suscripcion: AdminSuscripcion | null
  estado: EstadoAdmin
  diasRestantes: number
  /** Personas que atienden el mismo negocio con su propio teléfono y PIN. */
  vendedores?: AdminVendedor[]
}

export interface AdminVendedor {
  usuarioId: string
  nombre: string | null
  telefono: string | null
  creadoEn: string
}

export interface AdminVendedorAgregado {
  ok: true
  vendedor: { usuarioId: string; nombre: string; telefono: string }
  credenciales: { telefono: string; pin: string }
}

export interface AdminEvento {
  id: string
  negocio_id: string
  suscripcion_id: string | null
  accion: string
  detalle: Record<string, unknown>
  actor_id: string | null
  creado_en: string
}

export interface AdminListado {
  ok: true
  cuentas: AdminCuenta[]
  eventos: AdminEvento[]
  planes: AdminPlan[]
}

export interface AdminCuentaCreada {
  ok: true
  cuenta: { id: string; nombre: string; telefono: string }
  credenciales: { telefono: string; pin: string }
  suscripcion: AdminSuscripcion | null
}

export interface AdminSuscripcionActualizada {
  ok: true
  suscripcion: AdminSuscripcion
}

export interface AdminCuentaActualizada {
  ok: true
  cuenta: { id: string; nombre: string; telefono: string; notaInterna: string | null }
}

export interface AdminCredencialesRegeneradas {
  ok: true
  credenciales: { telefono: string; pin: string }
}

export interface AdminPlanGuardado {
  ok: true
  plan: AdminPlan
}

export type AdminSolicitud =
  | { accion: 'listar' }
  | { accion: 'crear'; nombre: string; telefono: string; pin: string; diasPrueba: number; planId?: string; nota?: string }
  | { accion: 'suscripcion'; negocioId: string; operacion: 'prueba' | 'activar' | 'extender' | 'suspender' | 'reactivar'; dias?: number; planId?: string; modo?: 'sumar' | 'reiniciar'; importeCentavos?: number; medioPago?: MedioPagoAdmin; referenciaPago?: string; nota?: string }
  | { accion: 'cuenta'; negocioId: string; operacion: 'editar'; nombre: string; telefono: string; notaInterna?: string }
  | { accion: 'cuenta'; negocioId: string; operacion: 'regenerar_pin'; pin: string }
  | { accion: 'plan'; operacion: 'crear'; nombre: string; descripcion?: string; tipo: TipoPlan; dias: number; precioCentavos: number; activo: boolean; orden: number }
  | { accion: 'plan'; operacion: 'actualizar'; planId: string; nombre: string; descripcion?: string; tipo: TipoPlan; dias: number; precioCentavos: number; activo: boolean; orden: number }
  | { accion: 'plan'; operacion: 'archivar' | 'restaurar'; planId: string }
  | { accion: 'vendedor'; negocioId: string; operacion: 'agregar'; nombre: string; telefono: string; pin: string }
  | { accion: 'vendedor'; negocioId: string; operacion: 'pin'; usuarioId: string; pin: string }
  | { accion: 'vendedor'; negocioId: string; operacion: 'quitar'; usuarioId: string }

/** Puerta única del panel: pasa por el puente del mismo sitio (/api/admin) y
 *  la función Edge valida la sesión y el rol antes de ejecutar cualquier
 *  lectura o escritura administrativa. */
export async function adminAccion<T extends AdminListado | AdminCuentaCreada | AdminSuscripcionActualizada | AdminCuentaActualizada | AdminCredencialesRegeneradas | AdminPlanGuardado | AdminVendedorAgregado | { ok: true }>(solicitud: AdminSolicitud): Promise<T> {
  if (!cliente) throw new Error('La nube no está configurada.')
  const sesion = await cliente.auth.getSession()
  const token = sesion.data.session?.access_token
  if (!token) throw new Error('Hay que iniciar sesión.')

  const respuesta = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(solicitud),
  })
  let datos: (T & { error?: unknown }) | null = null
  try {
    datos = await respuesta.json() as T & { error?: unknown }
  } catch {
    // Una respuesta que no es JSON se trata abajo como error genérico.
  }
  if (datos && typeof datos.error === 'string') throw new Error(datos.error)
  if (!respuesta.ok) throw new Error('No se pudo completar la operación.')
  if (!datos) throw new Error('La función administrativa no devolvió una respuesta.')
  return datos as T
}
