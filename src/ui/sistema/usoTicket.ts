'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAjustesNegocio } from './usoAjustesNegocio'
import {
  normalizarPreferenciasTicket,
  PREFERENCIAS_TICKET_INICIALES,
  type PreferenciasTicket,
} from '@/dominio/ticketImpreso'

/** Copia de este aparato: el ancho del papel vive sólo acá. */
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

/** El ancho del papel es de este aparato (la impresora está en el
 *  mostrador); la frase del pie es del negocio y la ven todos los aparatos. */
export function useTicket(): [PreferenciasTicket, (cambio: Partial<PreferenciasTicket>) => void] {
  const delAparato = useSyncExternalStore(suscribirse, leer, () => PREFERENCIAS_TICKET_INICIALES)
  const [ajustes, cambiarAjustes] = useAjustesNegocio()
  const preferencias = useMemo(
    () => normalizarPreferenciasTicket({ ...delAparato, ...(ajustes.leyendaTicket !== undefined ? { leyenda: ajustes.leyendaTicket } : {}) }),
    [delAparato, ajustes.leyendaTicket],
  )
  const cambiar = useCallback((cambio: Partial<PreferenciasTicket>) => {
    if (cambio.leyenda !== undefined) cambiarAjustes({ leyendaTicket: cambio.leyenda })
    const siguiente = normalizarPreferenciasTicket({ ...leer(), ...cambio })
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(siguiente))
      enMemoria = null
    } catch {
      enMemoria = siguiente
    }
    window.dispatchEvent(new Event(EVENTO))
  }, [cambiarAjustes])
  return [preferencias, cambiar]
}
