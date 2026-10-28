'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { puede, rolDe, type AccionSoloDueno, type Rol } from '@/dominio/roles'

/** El rol de quien usa el aparato. Mientras se lee la base local devuelve
 *  null: las acciones del dueño recién aparecen cuando se sabe que lo es. */
export function useRol(): Rol | null {
  return useLiveQuery(async () => rolDe((await db.negocio.get('unico'))?.rol), [], null)
}

export function usePuede(accion: AccionSoloDueno): boolean {
  const rol = useRol()
  return rol !== null && puede(rol, accion)
}
