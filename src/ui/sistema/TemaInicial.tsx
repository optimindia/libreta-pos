'use client'

import { useEffect } from 'react'
import { aplicarTema, leerPreferenciaTema } from './tema'

export function TemaInicial() {
  useEffect(() => {
    const actualizar = () => aplicarTema(leerPreferenciaTema())
    actualizar()
    const reloj = window.setInterval(actualizar, 60_000)
    return () => window.clearInterval(reloj)
  }, [])
  return null
}
