'use client'

import { useEffect } from 'react'
import { nubeActiva } from '@/datos/nube/cliente'
import { negocioDeLaNube } from '@/datos/nube/sesion'
import { sincronizar, subirASupabase } from '@/datos/nube/sincronizar'
import { hayPendientes } from '@/datos/local/cola'

const CADA_MS = 30_000

/** Sube la cola cuando hay red. Nunca bloquea la venta: si falla, el dato
 *  ya está guardado en el teléfono y se reintenta en la próxima vuelta. */
export function Sincronizador() {
  useEffect(() => {
    if (!nubeActiva()) return

    let vivo = true

    async function intentar() {
      if (!vivo || !navigator.onLine) return
      const negocioId = await negocioDeLaNube()
      if (!negocioId) return // todavía sin respaldo: no hay a dónde subir
      if (!(await hayPendientes())) return
      try {
        await sincronizar(subirASupabase(negocioId))
      } catch {
        // sin red o sin sesión: se reintenta solo
      }
    }

    intentar()
    const reloj = setInterval(intentar, CADA_MS)
    window.addEventListener('online', intentar)

    return () => {
      vivo = false
      clearInterval(reloj)
      window.removeEventListener('online', intentar)
    }
  }, [])

  return null
}
