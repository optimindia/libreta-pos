'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  normalizarPreferenciasTicket,
  PREFERENCIAS_TICKET_INICIALES,
  type PreferenciasTicket,
} from '@/dominio/ticketImpreso'

/** Ancho del papel y leyenda del ticket: una preferencia de cada aparato
 *  (la impresora está en el mostrador, no en la cuenta), así que vive en
 *  localStorage y no se sincroniza. */
const CLAVE = 'libreta-ticket'
const EVENTO = 'libreta-ticket-cambio'

let cacheTexto: string | null = null
let cacheValor: PreferenciasTicket = PREFERENCIAS_TICKET_INICIALES
/** Si el navegador no deja guardar (modo privado), vive acá. */
let enMemoria: PreferenciasTicket | null = null

function leer(): PreferenciasTicket {
  if (enMemoria) return enMemoria
  let texto: string | null = null
  try {
    texto = window.localStorage.getItem(CLAVE)
  } catch {
    return cacheValor
  }
  if (texto === cacheTexto) return cacheValor
  cacheTexto = texto
  try {
    cacheValor = normalizarPreferenciasTicket(texto ? JSON.parse(texto) : null)
  } catch {
    cacheValor = PREFERENCIAS_TICKET_INICIALES
  }
  return cacheValor
}

function suscribirse(avisar: () => void): () => void {
  const alCambiar = (evento: Event) => {
    if (evento instanceof StorageEvent && evento.key !== CLAVE) return
    avisar()
  }
  window.addEventListener('storage', alCambiar)
  window.addEventListener(EVENTO, alCambiar)
  return () => {
    window.removeEventListener('storage', alCambiar)
    window.removeEventListener(EVENTO, alCambiar)
  }
}

export function useTicket(): [PreferenciasTicket, (cambio: Partial<PreferenciasTicket>) => void] {
  const preferencias = useSyncExternalStore(suscribirse, leer, () => PREFERENCIAS_TICKET_INICIALES)
  const cambiar = useCallback((cambio: Partial<PreferenciasTicket>) => {
    const siguiente = normalizarPreferenciasTicket({ ...leer(), ...cambio })
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(siguiente))
      enMemoria = null
    } catch {
      enMemoria = siguiente
    }
    window.dispatchEvent(new Event(EVENTO))
  }, [])
  return [preferencias, cambiar]
}
