import { useSyncExternalStore } from 'react'

const CONSULTA = '(min-width: 900px)'

function suscribir(aviso: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const lista = window.matchMedia(CONSULTA)
  lista.addEventListener('change', aviso)
  return () => lista.removeEventListener('change', aviso)
}

/** true en la PC (≥ 900 px): ahí la cuenta de un cliente vive en un panel al
 *  lado de la lista; en el celu, en una hoja que sube desde abajo. Sin
 *  `matchMedia` (pruebas, servidor) se asume la PC. */
export function usePantallaAncha(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(CONSULTA).matches),
    () => true,
  )
}
