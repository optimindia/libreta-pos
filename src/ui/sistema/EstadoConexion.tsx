'use client'

import { useSyncExternalStore } from 'react'

function suscribirse(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function estadoActual(): boolean {
  return navigator.onLine
}

function estadoServidor(): boolean {
  // El servidor no puede consultar la red; este valor debe coincidir con el
  // primer render para evitar diferencias de hidratación.
  return true
}

export function EstadoConexion() {
  const online = useSyncExternalStore(suscribirse, estadoActual, estadoServidor)

  return <span className="hidden text-[12px] sm:inline" aria-live="polite" style={{ color: online ? 'var(--verde)' : 'var(--ambar)' }}>{online ? 'Conectado' : 'Sin conexión'}</span>
}
