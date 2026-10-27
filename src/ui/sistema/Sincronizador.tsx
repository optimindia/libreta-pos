'use client'

import { useEffect } from 'react'
import { cliente, nubeActiva } from '@/datos/nube/cliente'
import { negocioDeLaNube } from '@/datos/nube/sesion'
import { sincronizar, subirASupabase } from '@/datos/nube/sincronizar'
import { bajarCambios, traerCambiosDeSupabase } from '@/datos/nube/bajada'
import { escucharCambios } from '@/datos/nube/realtime'
import { EVENTO_DATOS_PENDIENTES } from '@/datos/local/cola'

const CADA_MS = 12_000
/** El timbre realtime llega en ráfagas (una venta toca varias tablas):
 *  esperar dos segundos junta la ráfaga en una sola bajada. */
const DEBOUNCE_MS = 2_000
const TABLAS = ['productos', 'ventas', 'clientes', 'fiados', 'fiado_pagos', 'ingresos', 'cierres', 'movimientos_caja', 'pedidos', 'negocio_configuracion']

/** Sincroniza en los dos sentidos cuando hay red. Nunca bloquea la venta:
 *  si algo falla, el dato ya está en el teléfono y se reintenta solo. */
export function Sincronizador() {
  useEffect(() => {
    if (!nubeActiva()) return

    let vivo = true
    let bajandoPendiente: ReturnType<typeof setTimeout> | null = null
    let subidaPendiente: ReturnType<typeof setTimeout> | null = null
    let enCurso: Promise<void> | null = null

    async function ejecutar() {
      if (!vivo || !navigator.onLine) return
      const sesion = await cliente?.auth.getSession()
      if (!sesion?.data.session) return
      const negocioId = await negocioDeLaNube()
      if (!negocioId) return // todavía sin respaldo: no hay a dónde subir
      try {
        await sincronizar(subirASupabase(negocioId))
        await bajarCambios(traerCambiosDeSupabase)
      } catch {
        // sin red o sin sesión: se reintenta solo
      }
    }

    /** Evita dos subidas simultáneas cuando se guardan varios productos de
     *  golpe o llegan juntos el evento local, realtime y el intervalo. */
    function intentar(): Promise<void> {
      if (enCurso) return enCurso
      enCurso = ejecutar().finally(() => { enCurso = null })
      return enCurso
    }

    function despertar() {
      if (subidaPendiente) clearTimeout(subidaPendiente)
      subidaPendiente = setTimeout(() => {
        subidaPendiente = null
        void intentar()
      }, 250)
    }

    function alVolverAlAparato() {
      if (document.visibilityState !== 'visible') return
      void intentar()
    }

    /** El timbre realtime: bajar lo nuevo, con debounce para juntar la ráfaga. */
    function timbre() {
      if (bajandoPendiente) clearTimeout(bajandoPendiente)
      bajandoPendiente = setTimeout(() => {
        bajandoPendiente = null
        void intentar()
      }, DEBOUNCE_MS)
    }

    void intentar()
    const reloj = setInterval(intentar, CADA_MS)
    window.addEventListener('online', intentar)
    window.addEventListener('focus', alVolverAlAparato)
    document.addEventListener('visibilitychange', alVolverAlAparato)
    window.addEventListener(EVENTO_DATOS_PENDIENTES, despertar)

    let pararEscucha: (() => void) | null = null
    async function actualizarEscucha() {
      if (!vivo || pararEscucha) return
      const sesion = await cliente?.auth.getSession()
      if (!sesion?.data.session) return
      const negocioId = await negocioDeLaNube()
      if (!vivo || !negocioId || pararEscucha) return
      pararEscucha = escucharCambios(TABLAS, timbre)
    }
    void actualizarEscucha()
    const auth = cliente?.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void intentar()
        void actualizarEscucha()
      }, 0)
    })

    return () => {
      vivo = false
      clearInterval(reloj)
      window.removeEventListener('online', intentar)
      window.removeEventListener('focus', alVolverAlAparato)
      document.removeEventListener('visibilitychange', alVolverAlAparato)
      window.removeEventListener(EVENTO_DATOS_PENDIENTES, despertar)
      if (bajandoPendiente) clearTimeout(bajandoPendiente)
      if (subidaPendiente) clearTimeout(subidaPendiente)
      pararEscucha?.()
      auth?.data.subscription.unsubscribe()
    }
  }, [])

  return null
}
