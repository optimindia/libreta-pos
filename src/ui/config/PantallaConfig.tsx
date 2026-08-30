'use client'

import { useEffect, useState } from 'react'
import { db } from '@/datos/local/db'
import { Boton } from '@/ui/sistema/Boton'
import { Respaldo } from './Respaldo'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

export function PantallaConfig() {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#12694E')
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    db.negocio.get('unico').then((negocio) => {
      if (!negocio) return
      setNombre(negocio.nombre)
      if (negocio.color) setColor(negocio.color)
      setLogo(negocio.logo)
    })
  }, [])

  async function guardar() {
    await db.negocio.put({ id: 'unico', nombre: nombre.trim(), logo, color })
  }

  function leerLogo(archivo: File) {
    const lector = new FileReader()
    lector.onload = () => setLogo(String(lector.result))
    lector.readAsDataURL(archivo)
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Tu negocio
      </h1>

      <div className="mt-3 flex flex-col gap-3">
        <label className="text-[12px]" style={{ color: 'var(--tenue)' }}>
          Nombre del negocio
          <input
            aria-label="Nombre del negocio"
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={campo}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </label>

        <label className="text-[12px]" style={{ color: 'var(--tenue)' }}>
          Color
          <input
            aria-label="Color" type="color"
            className="mt-1 h-11 w-full rounded-xl"
            style={campo}
            value={color}
            onChange={(evento) => setColor(evento.target.value)}
          />
        </label>

        <label className="text-[12px]" style={{ color: 'var(--tenue)' }}>
          Logo
          <input
            aria-label="Logo" type="file" accept="image/*"
            className="mt-1 w-full text-[12px]"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (archivo) leerLogo(archivo)
            }}
          />
        </label>

        <Boton variante="principal" onClick={guardar}>Guardar</Boton>
      </div>

      <Respaldo />
    </div>
  )
}
