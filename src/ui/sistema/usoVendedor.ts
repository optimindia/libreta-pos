'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { rolDe, type Rol } from '@/dominio/roles'
import type { UUID } from '@/dominio/tipos'

export interface Identidad {
  rol: Rol
  usuarioId?: UUID
  nombre?: string | null
}

/** Quién usa el aparato (rol, id y nombre). Mientras se lee la base local
 *  devuelve null: nadie ve filas ni filtros hasta saber si es dueño o
 *  vendedor, así un vendedor nunca ve de golpe las ventas de todos. */
export function useIdentidad(): Identidad | null {
  return useLiveQuery(async () => {
    const negocio = await db.negocio.get('unico')
    return { rol: rolDe(negocio?.rol), usuarioId: negocio?.usuarioId, nombre: negocio?.nombreUsuario }
  }, [], null)
}
