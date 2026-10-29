'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Actualización del service worker con aviso (PWA-02).
 *  La versión nueva se instala en segundo plano y queda "esperando". Recién
 *  se activa (y la pantalla se recarga) cuando alguien toca Actualizar, o
 *  sola si la app está en segundo plano. Nunca en medio de una venta o un
 *  cobro: el ticket vive en memoria y recargar lo perdería. */

/** Costura para las pruebas: jsdom no puede recargar la página. */
export const entornoSW = {
  recargar: () => window.location.reload(),
}

// ───────────── Venta abierta (lo escribe Vender, lo lee la actualización) ─────────────

let ventaAbierta = false
const oyentes = new Set<() => void>()

export function ventaAbiertaAhora(): boolean {
  return ventaAbierta
}

export function setVentaAbierta(abierta: boolean): void {
  if (ventaAbierta === abierta) return
  ventaAbierta = abierta
  oyentes.forEach((oyente) => oyente())
}

function suscribirVenta(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

/** Para la pantalla de vender: mientras `abierta`, no se recarga la app. */
export function useMarcarVentaAbierta(abierta: boolean): void {
  useEffect(() => {
    setVentaAbierta(abierta)
    return () => setVentaAbierta(false)
  }, [abierta])
}

// ───────────── Hook ─────────────

export interface ActualizacionSW {
  /** Hay una versión nueva instalada, esperando. */
  hayNueva: boolean
  /** Se pidió actualizar pero hay una venta abierta: se hace al terminarla. */
  esperandoVenta: boolean
  actualizar: () => void
}

const UNA_HORA = 60 * 60 * 1000

export function useActualizacionSW(): ActualizacionSW {
  const [espera, setEspera] = useState<ServiceWorker | null>(null)
  const [pedida, setPedida] = useState(false)
  const activando = useRef(false)
  const abierta = useSyncExternalStore(suscribirVenta, ventaAbiertaAhora, () => false)

  // Registro y detección de versiones nuevas.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const contenedor = navigator.serviceWorker
    let vivo = true
    let reloj: number | undefined
    let registro: ServiceWorkerRegistration | undefined

    // Sólo es una "actualización" si ya había una versión controlando la
    // página; la primera instalación se activa sola y no hay nada que avisar.
    const hayAnterior = () => Boolean(contenedor.controller)

    const vigilar = (nuevo: ServiceWorker | null) => {
      if (!nuevo) return
      const revisar = () => {
        if (nuevo.state === 'installed' && hayAnterior() && vivo) setEspera(nuevo)
      }
      nuevo.addEventListener('statechange', revisar)
      revisar()
    }

    const alCambiarControl = () => {
      // Sólo recargamos si fuimos nosotros quienes pedimos el cambio y no
      // hay una venta abierta (la activación ya se difirió hasta entonces).
      if (!activando.current || ventaAbiertaAhora()) return
      activando.current = false
      entornoSW.recargar()
    }
    contenedor.addEventListener('controllerchange', alCambiarControl)

    const alVolver = () => { void registro?.update().catch(() => undefined) }
    const alCambiarVisibilidad = () => { if (document.visibilityState === 'visible') alVolver() }

    contenedor.register('/sw.js').then((r) => {
      if (!vivo) return
      registro = r
      if (r.waiting && hayAnterior()) setEspera(r.waiting)
      r.addEventListener('updatefound', () => vigilar(r.installing))
      reloj = window.setInterval(alVolver, UNA_HORA)
      document.addEventListener('visibilitychange', alCambiarVisibilidad)
    }).catch(() => {
      // sin service worker la app sigue funcionando: sólo pierde el arranque offline
    })

    return () => {
      vivo = false
      contenedor.removeEventListener('controllerchange', alCambiarControl)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      if (reloj) window.clearInterval(reloj)
    }
  }, [])

  const aplicar = useCallback(() => {
    if (!espera || activando.current) return
    activando.current = true
    espera.postMessage({ tipo: 'SKIP_WAITING' })
  }, [espera])

  // Pedida por la persona: se aplica apenas no haya una venta abierta.
  useEffect(() => {
    if (pedida && espera && !abierta) aplicar()
  }, [pedida, espera, abierta, aplicar])

  // Sin pedido: sólo si la app está en segundo plano y no hay venta abierta.
  useEffect(() => {
    if (!espera) return
    const siEstaOculta = () => {
      if (document.visibilityState === 'hidden' && !ventaAbiertaAhora()) aplicar()
    }
    document.addEventListener('visibilitychange', siEstaOculta)
    return () => document.removeEventListener('visibilitychange', siEstaOculta)
  }, [espera, aplicar])

  return {
    hayNueva: Boolean(espera),
    esperandoVenta: Boolean(espera) && pedida && abierta,
    actualizar: () => setPedida(true),
  }
}
