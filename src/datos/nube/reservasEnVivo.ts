import type { RealtimeChannel } from '@supabase/supabase-js'
import type { UUID } from '@/dominio/tipos'
import { cliente } from './cliente'

/** Lo que cada aparato lleva en sus ventas abiertas (todavía sin cobrar),
 *  avisado en vivo a los demás aparatos del negocio. No se guarda en ningún
 *  lado: si el aparato cobra, vacía la venta o se desconecta, la reserva
 *  desaparece sola.
 *
 *  Usa Presence de Supabase Realtime en un canal privado por negocio: la
 *  base sólo deja entrar a quien tiene acceso a ese negocio. */

export type Reservas = Map<UUID, number>

interface EstadoAparato {
  items: Record<UUID, number>
}

const VACIO: Reservas = new Map()
let deOtros: Reservas = VACIO
const oyentes = new Set<() => void>()

let canal: RealtimeChannel | null = null
let negocioConectado: UUID | null = null
let ultimoPublicado = '{}'
let pendiente: Record<UUID, number> | null = null
let enviando: ReturnType<typeof setTimeout> | null = null

function avisar() {
  for (const oyente of oyentes) oyente()
}

/** Un id por aparato, estable entre aperturas. */
export function idDeEsteAparato(): string {
  try {
    const guardado = localStorage.getItem('libreta.aparato')
    if (guardado) return guardado
    const nuevo = crypto.randomUUID()
    localStorage.setItem('libreta.aparato', nuevo)
    return nuevo
  } catch {
    return (globalThis as { __libretaAparato?: string }).__libretaAparato ??= crypto.randomUUID()
  }
}

/** Suma lo de todos los aparatos menos éste. */
export function sumarReservas(estado: Record<string, EstadoAparato[]>, propio: string): Reservas {
  const total: Reservas = new Map()
  for (const [aparato, presencias] of Object.entries(estado)) {
    if (aparato === propio) continue
    // Un aparato con dos pestañas aparece dos veces: se toma la más grande
    // de cada producto para no contar dos veces la misma venta.
    const delAparato = new Map<UUID, number>()
    for (const presencia of presencias) {
      for (const [producto, cantidad] of Object.entries(presencia.items ?? {})) {
        if (typeof cantidad !== 'number' || !(cantidad > 0)) continue
        delAparato.set(producto, Math.max(delAparato.get(producto) ?? 0, cantidad))
      }
    }
    for (const [producto, cantidad] of delAparato) total.set(producto, (total.get(producto) ?? 0) + cantidad)
  }
  return total
}

export function conectarReservas(negocioId: UUID): () => void {
  if (!cliente || negocioConectado === negocioId) return () => undefined
  desconectarReservas()
  const propio = idDeEsteAparato()
  negocioConectado = negocioId
  const nuevo = cliente.channel(`reservas:${negocioId}`, {
    config: { private: true, presence: { key: propio } },
  })
  nuevo.on('presence', { event: 'sync' }, () => {
    deOtros = sumarReservas(nuevo.presenceState<EstadoAparato>(), propio)
    avisar()
  })
  nuevo.subscribe((estado) => {
    if (estado === 'SUBSCRIBED') void nuevo.track({ items: JSON.parse(ultimoPublicado) as Record<UUID, number> })
  })
  canal = nuevo
  return desconectarReservas
}

export function desconectarReservas(): void {
  if (enviando) clearTimeout(enviando)
  enviando = null
  if (canal) void canal.unsubscribe()
  canal = null
  negocioConectado = null
  if (deOtros.size > 0) {
    deOtros = VACIO
    avisar()
  }
}

/** Avisa lo que este aparato tiene en sus ventas abiertas. Se agrupan los
 *  cambios rápidos (tocar "+" varias veces) en un solo aviso. */
export function publicarReservas(items: Record<UUID, number>): void {
  const texto = JSON.stringify(items)
  if (texto === ultimoPublicado && !pendiente) return
  pendiente = items
  if (enviando) return
  enviando = setTimeout(() => {
    enviando = null
    const aEnviar = pendiente
    pendiente = null
    if (!aEnviar) return
    const nuevoTexto = JSON.stringify(aEnviar)
    if (nuevoTexto === ultimoPublicado) return
    ultimoPublicado = nuevoTexto
    if (canal) void canal.track({ items: aEnviar })
  }, 250)
}

export function reservasDeOtros(): Reservas {
  return deOtros
}

export function escucharReservas(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}
