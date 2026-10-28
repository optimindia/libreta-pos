'use client'

import { useEffect, useState } from 'react'
import { aplicarTema, guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from '@/ui/sistema/tema'
import { Boton } from '@/ui/sistema/Boton'

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
    <div className="mt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Apariencia</h2>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {OPCIONES.map((opcion) => (
          <Boton key={opcion.valor} variante={preferencia === opcion.valor ? 'principal' : 'secundario'} className="!rounded-xl !px-1 !py-2.5 !text-[12px]" aria-pressed={preferencia === opcion.valor} onClick={() => cambiar(opcion.valor)}>
            {opcion.texto}
          </Boton>
        ))}
      </div>
    </div>
  )
}
