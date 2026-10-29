'use client'

import { useEffect } from 'react'
// Escucha el aviso de instalación desde el arranque (ver instalacion.ts).
import './instalacion'
import { useActualizacionSW } from './actualizacionSW'
import { AvisoVersionNueva } from './AvisoVersionNueva'

export function RegistrarSW() {
  const { hayNueva, esperandoVenta, actualizar } = useActualizacionSW()

  useEffect(() => {
    // Sin almacenamiento persistente el navegador puede borrar IndexedDB
    // (Safari lo hace tras 7 días sin uso) y con él ventas que no subieron.
    const almacenamiento = navigator.storage
    if (almacenamiento?.persist && almacenamiento.persisted) {
      void almacenamiento.persisted()
        .then((ya) => (ya ? true : almacenamiento.persist()))
        .catch(() => false)
    }
  }, [])

  if (!hayNueva) return null
  return <AvisoVersionNueva esperandoVenta={esperandoVenta} onActualizar={actualizar} />
}
