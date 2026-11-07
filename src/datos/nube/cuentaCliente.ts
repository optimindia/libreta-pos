import { cliente } from './cliente'
import { db } from '@/datos/local/db'
import type { Centavos, UUID } from '@/dominio/tipos'

/** El link de "mirá tu cuenta" de un cliente: un token largo y aleatorio
 *  guardado en la nube. Quien lo tiene ve sólo el saldo y los movimientos
 *  de ese cliente (lo resuelve la función cuenta_cliente). */
export class ErrorEnlaceCuenta extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorEnlaceCuenta'
  }
}

function tokenNuevo(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function urlDeCuenta(token: string, origen: string): string {
  return `${origen.replace(/\/$/, '')}/saldo#${token}`
}

async function negocioActual(): Promise<UUID> {
  const negocio = await db.negocio.get('unico')
  if (!cliente || !negocio?.negocioId) throw new ErrorEnlaceCuenta('Para compartir la cuenta tiene que estar activada la nube.')
  return negocio.negocioId
}

/** El link vigente del cliente; si no tiene, crea uno. Necesita conexión. */
export async function enlaceDeCuenta(clienteId: UUID): Promise<string> {
  const negocioId = await negocioActual()
  const existente = await cliente!.from('cuentas_compartidas')
    .select('token').eq('negocio_id', negocioId).eq('cliente_id', clienteId).is('revocado_en', null)
    .order('creado_en', { ascending: false }).limit(1)
  if (existente.error) throw new ErrorEnlaceCuenta('No se pudo conectar. Probá de nuevo con internet.')
  if (existente.data && existente.data.length > 0) return existente.data[0].token as string
  const token = tokenNuevo()
  const creado = await cliente!.from('cuentas_compartidas').insert({ token, negocio_id: negocioId, cliente_id: clienteId })
  if (creado.error) throw new ErrorEnlaceCuenta(creado.error.code === '23503' || creado.error.code === '42501'
    ? 'Este cliente todavía no llegó a la nube. Esperá a que diga "Guardado" y probá de nuevo.'
    : 'No se pudo crear el link. Probá de nuevo con internet.')
  return token
}

/** Corta todos los links del cliente: quien los tenga ya no ve nada. */
export async function dejarDeCompartir(clienteId: UUID): Promise<void> {
  const negocioId = await negocioActual()
  const { error } = await cliente!.from('cuentas_compartidas')
    .update({ revocado_en: new Date().toISOString() })
    .eq('negocio_id', negocioId).eq('cliente_id', clienteId).is('revocado_en', null)
  if (error) throw new ErrorEnlaceCuenta('No se pudo cortar el link. Probá de nuevo con internet.')
}

export interface CuentaCompartida {
  negocio: string
  cliente: string
  saldo: Centavos
  fiados: Array<{ fecha: string; monto: Centavos; items: Array<{ nombre: string; cantidad: number }> }>
  pagos: Array<{ fecha: string; monto: Centavos }>
}

/** Lo que ve el cliente al abrir el link. Null si el link no existe o se cortó. */
export async function leerCuentaCompartida(token: string): Promise<CuentaCompartida | null> {
  if (!cliente) throw new ErrorEnlaceCuenta('La cuenta no está disponible.')
  const { data, error } = await cliente.rpc('cuenta_cliente', { p_token: token })
  if (error) throw new ErrorEnlaceCuenta('No se pudo cargar la cuenta. Revisá la conexión.')
  if (!data) return null
  const crudo = data as CuentaCompartida
  return {
    negocio: String(crudo.negocio ?? ''),
    cliente: String(crudo.cliente ?? ''),
    saldo: Number(crudo.saldo) || 0,
    fiados: (crudo.fiados ?? []).map((fiado) => ({ ...fiado, monto: Number(fiado.monto) || 0, items: (fiado.items ?? []).map((item) => ({ nombre: String(item.nombre), cantidad: Number(item.cantidad) || 0 })) })),
    pagos: (crudo.pagos ?? []).map((pago) => ({ ...pago, monto: Number(pago.monto) || 0 })),
  }
}
