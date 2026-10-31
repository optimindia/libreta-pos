'use client'

import { useEffect } from 'react'
import { cliente, nubeActiva } from '@/datos/nube/cliente'
import { negocioDeLaNube } from '@/datos/nube/sesion'
import { SesionVencida, sincronizar, subirASupabase } from '@/datos/nube/sincronizar'
import { notificarCambioAcceso } from '@/datos/nube/acceso'
import { bajarCambios, traerCambiosDeSupabase } from '@/datos/nube/bajada'
import { escucharCambios } from '@/datos/nube/realtime'
import { EVENTO_DATOS_PENDIENTES, reintentarTodos } from '@/datos/local/cola'

const CADA_MS = 12_000
/** El timbre realtime llega en ráfagas (una venta toca varias tablas):
 *  esperar dos segundos junta la ráfaga en una sola bajada. */
const DEBOUNCE_MS = 2_000
const TABLAS = ['productos', 'ventas', 'clientes', 'fiados', 'fiado_pagos', 'ingresos', 'cierres', 'movimientos_caja', 'pedidos', 'negocio_configuracion']

/** Una sola vez por aparato: el 31/10 la base rechazaba ventas, cobros de
 *  fiado y productos por permisos que faltaban. Ya están; lo que quedó
 *  apartado se vuelve a mandar solo, sin que nadie tenga que tocar nada. */
const MARCA_REINTENTO = 'libreta.reintento.permisos-2026-10-31'

async function reintentarApartadosUnaVez(): Promise<void> {
  try {
    if (localStorage.getItem(MARCA_REINTENTO)) return
    localStorage.setItem(MARCA_REINTENTO, '1')
  } catch {
    return // sin almacenamiento no se puede marcar: no se arriesga un bucle
  }
  await reintentarTodos()
}

/** El token venció y no se renueva solo (por ejemplo, la sesión se cerró en
 *  otro aparato). Sin red se espera; si la nube dice que la sesión ya no
 *  vale, se cierra sólo acá, sin borrar nada: la pantalla de ingreso aparece
 *  y, al entrar con el mismo teléfono y PIN, lo pendiente se sube. */
async function renovarSesion(): Promise<void> {
  if (!cliente) return
  const renovada = await cliente.auth.refreshSession()
  if (!renovada.error) return
  if (renovada.error.name === 'AuthRetryableFetchError' || !navigator.onLine) return
  await cliente.auth.signOut({ scope: 'local' })
  notificarCambioAcceso()
}

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
        await reintentarApartadosUnaVez()
        await sincronizar(subirASupabase(negocioId))
        await bajarCambios(traerCambiosDeSupabase)
      } catch (error) {
        if (error instanceof SesionVencida) await renovarSesion().catch(() => undefined)
        // sin red: se reintenta solo
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
