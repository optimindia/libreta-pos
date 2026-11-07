'use client'

import { useEffect, useRef } from 'react'

/** Llevar a una pantalla con algo ya elegido (?buscar=, ?cliente=…). La
 *  pantalla lo lee al abrirse; si ya estaba abierta, le llega por evento. */
const EVENTO = 'libreta:destino'

export function irA(navegar: (href: string) => void, href: string): void {
  navegar(href)
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO, { detail: href })), 60)
}

/** Llama a `alRecibir` con los parámetros que trajo la navegación: al
 *  montarse (de la dirección) y cada vez que se vuelve a buscar algo. */
export function useDestino(ruta: string, alRecibir: (parametros: URLSearchParams) => void): void {
  const callback = useRef(alRecibir)
  useEffect(() => { callback.current = alRecibir })
  useEffect(() => {
    function aplicar(href: string) {
      const url = new URL(href, window.location.origin)
      if (url.pathname !== ruta || url.search === '') return
      callback.current(url.searchParams)
    }
    aplicar(window.location.href)
    const escuchar = (evento: Event) => aplicar(String((evento as CustomEvent).detail ?? ''))
    window.addEventListener(EVENTO, escuchar)
    return () => window.removeEventListener(EVENTO, escuchar)
  }, [ruta])
}
