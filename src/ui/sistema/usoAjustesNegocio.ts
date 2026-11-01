'use client'

import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { normalizarAjustes, repos } from '@/datos/local/repos'
import type { AjustesNegocio } from '@/dominio/tipos'

/** Dónde vivían estos ajustes antes de compartirse entre aparatos. */
const CLAVES_VIEJAS: Record<keyof AjustesNegocio, string> = {
  metaPlata: 'libreta-objetivo-periodo',
  metaPro: 'libreta:objetivo-pro-pesos',
  leyendaTicket: 'libreta-ticket',
}

function leerViejo(clave: keyof AjustesNegocio): string | undefined {
  try {
    const crudo = window.localStorage.getItem(CLAVES_VIEJAS[clave])
    if (crudo === null) return undefined
    if (clave !== 'leyendaTicket') return crudo
    const ticket = JSON.parse(crudo) as { leyenda?: unknown }
    return typeof ticket.leyenda === 'string' ? ticket.leyenda : undefined
  } catch {
    return undefined
  }
}

/** Metas y leyenda del ticket: las mismas en todos los aparatos del negocio.
 *  Mientras la nube no tenga un valor, se muestra el que este aparato tenía
 *  guardado de antes. */
export function useAjustesNegocio(): [AjustesNegocio, (cambio: Partial<AjustesNegocio>) => void] {
  const guardados = useLiveQuery(() => db.preferencias.get('unico'), [], null)
  const ajustes = useMemo(() => {
    const base = normalizarAjustes(guardados?.ajustes)
    if (typeof window === 'undefined') return base
    for (const clave of Object.keys(CLAVES_VIEJAS) as Array<keyof AjustesNegocio>) {
      if (base[clave] === undefined) {
        const viejo = leerViejo(clave)
        if (viejo !== undefined) base[clave] = viejo
      }
    }
    return base
  }, [guardados?.ajustes])
  const cambiar = useCallback((cambio: Partial<AjustesNegocio>) => {
    void repos.preferencias.guardarAjustes(cambio)
  }, [])
  return [ajustes, cambiar]
}

/** Una sola vez: sube lo que este aparato tenía guardado sólo para él, si
 *  el negocio todavía no tiene ese ajuste. */
export async function compartirAjustesDelAparato(): Promise<void> {
  const actuales = normalizarAjustes((await db.preferencias.get('unico'))?.ajustes)
  const cambio: Partial<AjustesNegocio> = {}
  for (const clave of Object.keys(CLAVES_VIEJAS) as Array<keyof AjustesNegocio>) {
    if (actuales[clave] !== undefined) continue
    const viejo = leerViejo(clave)
    if (viejo !== undefined) cambio[clave] = viejo
  }
  if (Object.keys(cambio).length > 0) await repos.preferencias.guardarAjustes(cambio)
}
