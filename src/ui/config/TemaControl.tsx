'use client'

import { useEffect, useState } from 'react'
import { aplicarTema, guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from '@/ui/sistema/tema'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

const OPCIONES: { valor: PreferenciaTema; texto: string }[] = [
  { valor: 'auto', texto: 'Automático' },
  { valor: 'claro', texto: 'Claro' },
  { valor: 'oscuro', texto: 'Oscuro' },
]

export function TemaControl() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('auto')
  useEffect(() => {
    const carga = window.setTimeout(() => setPreferencia(leerPreferenciaTema()), 0)
    return () => window.clearTimeout(carga)
  }, [])

  function cambiar(nueva: PreferenciaTema) {
    setPreferencia(nueva)
    guardarPreferenciaTema(nueva)
    aplicarTema(nueva)
  }

  return (
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-apariencia">
      <h2 id="config-apariencia" className="f-seccion">Apariencia</h2>
      <Segmentado etiqueta="Apariencia" opciones={OPCIONES} valor={preferencia} onCambiar={cambiar} />
    </Tarjeta>
  )
}
