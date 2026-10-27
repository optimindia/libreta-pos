'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { normalizarFunciones, type FuncionesNegocio } from '@/dominio/funciones'

/**
 * Lee las funciones desde Dexie para que la navegación, las rutas y los
 * módulos reaccionen al mismo cambio sin depender de estados duplicados.
 * Mientras carga se muestran los valores por defecto: una función nueva no
 * puede hacer desaparecer la aplicación durante el primer render.
 */
export function useFuncionesNegocio(): {
  funciones: FuncionesNegocio
  cargando: boolean
} {
  const preferencias = useLiveQuery(() => db.preferencias.get('unico'), [], null)
  const funciones = useMemo(
    () => normalizarFunciones(preferencias?.funciones),
    [preferencias?.funciones],
  )
  return { funciones, cargando: preferencias === undefined }
}
