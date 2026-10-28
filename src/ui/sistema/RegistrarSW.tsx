'use client'

import { useEffect } from 'react'
// Escucha el aviso de instalación desde el arranque (ver instalacion.ts).
import './instalacion'

export function RegistrarSW() {
  useEffect(() => {
    // Sin almacenamiento persistente el navegador puede borrar IndexedDB
    // (Safari lo hace tras 7 días sin uso) y con él ventas que no subieron.
    const almacenamiento = navigator.storage
    if (almacenamiento?.persist && almacenamiento.persisted) {
      void almacenamiento.persisted()
        .then((ya) => (ya ? true : almacenamiento.persist()))
        .catch(() => false)
    }
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker la app sigue funcionando: sólo pierde el arranque offline
    })
  }, [])
  return null
}
