'use client'

import { useCallback, useEffect, useState } from 'react'
import type { UUID } from '@/dominio/tipos'

/** Cuándo se le mandó a cada cliente el último recordatorio por WhatsApp.
 *  Vive en este aparato: es una ayuda para no avisar dos veces el mismo día. */
const CLAVE = 'libreta.avisosFiado'

function leer(): Record<UUID, number> {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    const valor = crudo ? (JSON.parse(crudo) as unknown) : null
    if (!valor || typeof valor !== 'object') return {}
    return Object.fromEntries(Object.entries(valor).filter(([, ts]) => typeof ts === 'number' && Number.isFinite(ts))) as Record<UUID, number>
  } catch {
    return {}
  }
}

export function useAvisosFiado(): [Record<UUID, number>, (clienteId: UUID) => void] {
  const [avisos, setAvisos] = useState<Record<UUID, number>>({})
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee del aparato después de montar
    setAvisos(leer())
  }, [])
  const marcar = useCallback((clienteId: UUID) => {
    const nuevos = { ...leer(), [clienteId]: Date.now() }
    try { window.localStorage.setItem(CLAVE, JSON.stringify(nuevos)) } catch { /* sin almacenamiento: sólo en pantalla */ }
    setAvisos(nuevos)
  }, [])
  return [avisos, marcar]
}
