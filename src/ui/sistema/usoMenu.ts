'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { MENU_INICIAL, normalizarMenu, type PreferenciasMenu } from '@/dominio/menu'

/** Cómo acomodó el menú cada aparato. Es una preferencia del dispositivo
 *  (la caja de la PC y el celu del dueño pueden querer cosas distintas),
 *  así que vive en localStorage y no se sincroniza. */
const CLAVE = 'libreta-menu'
const EVENTO = 'libreta-menu-cambio'

let cacheTexto: string | null = null
let cacheValor: PreferenciasMenu = MENU_INICIAL
/** Si el navegador no deja guardar (modo privado), el menú vive acá. */
let enMemoria: PreferenciasMenu | null = null

function leer(): PreferenciasMenu {
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
    cacheValor = normalizarMenu(texto ? JSON.parse(texto) : null)
  } catch {
    cacheValor = MENU_INICIAL
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

export function useMenu(): [PreferenciasMenu, (cambio: (actual: PreferenciasMenu) => PreferenciasMenu) => void] {
  const menu = useSyncExternalStore(suscribirse, leer, () => MENU_INICIAL)
  const cambiar = useCallback((cambio: (actual: PreferenciasMenu) => PreferenciasMenu) => {
    const siguiente = cambio(leer())
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(siguiente))
    } catch {
      // modo privado o almacenamiento lleno: el cambio dura hasta recargar
      enMemoria = siguiente
    }
    window.dispatchEvent(new Event(EVENTO))
  }, [])
  return [menu, cambiar]
}
