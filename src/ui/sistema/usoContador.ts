'use client'

import { useEffect, useRef, useState } from 'react'

/** Curva que arranca rápido y frena suave al llegar. */
export const frenarSuave = (t: number) => 1 - (1 - t) ** 3

function sinMovimiento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

/** Un número que sube hasta `valor` en `duracion` ms (con requestAnimationFrame,
 *  sin tocar el layout). Si `animar` es falso o el aparato pide menos
 *  movimiento, muestra el valor final de entrada. Cuando el valor cambia
 *  después, anima desde el anterior. */
export function useContador(
  valor: number,
  { animar = true, duracion = 700, paso = 1 }: { animar?: boolean; duracion?: number; paso?: number } = {},
): number {
  // Mientras anima guarda el número que se ve; quieto vale null y se muestra `valor`.
  const [enCurso, setEnCurso] = useState<number | null>(() => (animar && !sinMovimiento() ? 0 : null))
  const visto = useRef(enCurso ?? valor)

  useEffect(() => {
    const desde = visto.current
    if (!animar || desde === valor || sinMovimiento() || typeof requestAnimationFrame !== 'function') {
      visto.current = valor
      if (desde !== valor) {
        // Sin animación: se suelta el número retenido en el próximo cuadro.
        const cuadro = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setEnCurso(null)) : 0
        return () => { if (cuadro) cancelAnimationFrame(cuadro) }
      }
      return
    }
    let cuadro = 0
    const inicio = performance.now()
    const avanzar = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      // De a `paso` (100 = pesos enteros) mientras sube; al final, el valor exacto.
      const actual = t < 1 ? Math.round((desde + (valor - desde) * frenarSuave(t)) / paso) * paso : valor
      visto.current = actual
      setEnCurso(t < 1 ? actual : null)
      if (t < 1) cuadro = requestAnimationFrame(avanzar)
    }
    cuadro = requestAnimationFrame(avanzar)
    return () => cancelAnimationFrame(cuadro)
  }, [valor, duracion, animar, paso])

  return enCurso ?? valor
}
