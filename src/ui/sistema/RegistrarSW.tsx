'use client'

import { useEffect } from 'react'
// Escucha el aviso de instalación desde el arranque (ver instalacion.ts).
import './instalacion'

export function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker la app sigue funcionando: sólo pierde el arranque offline
    })
  }, [])
  return null
}
