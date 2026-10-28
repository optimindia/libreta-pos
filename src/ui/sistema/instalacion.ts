'use client'

import { useSyncExternalStore } from 'react'

/** Instalar Libreta como app (PWA).
 *  Chrome/Edge/Android avisan con `beforeinstallprompt`, que puede llegar
 *  antes de que se monte cualquier botón: por eso se escucha apenas carga
 *  el módulo (lo importa RegistrarSW, que está en el layout raíz).
 *  En iPhone no hay aviso: se explica cómo agregarla a la pantalla de inicio. */

type AvisoInstalacion = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type EstadoInstalacion = 'instalada' | 'disponible' | 'ios' | 'no-disponible'

let aviso: AvisoInstalacion | null = null
let instaladaAhora = false
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((oyente) => oyente())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault() // lo mostramos nosotros, con nuestro botón
    aviso = evento as AvisoInstalacion
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    instaladaAhora = true
    avisar()
  })
}

function enModoApp(): boolean {
  const navegador = window.navigator as Navigator & { standalone?: boolean }
  return instaladaAhora || navegador.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function esIos(): boolean {
  const { userAgent, maxTouchPoints, platform } = window.navigator
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

function estado(): EstadoInstalacion {
  if (enModoApp()) return 'instalada'
  if (aviso) return 'disponible'
  if (esIos()) return 'ios'
  return 'no-disponible'
}

function suscribirse(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function useInstalacion(): EstadoInstalacion {
  return useSyncExternalStore(suscribirse, estado, () => 'no-disponible')
}

/** Abre el cartel del navegador. Devuelve true si la persona aceptó. */
export async function instalarApp(): Promise<boolean> {
  if (!aviso) return false
  const actual = aviso
  await actual.prompt()
  const { outcome } = await actual.userChoice
  aviso = null
  avisar()
  return outcome === 'accepted'
}
