'use client'

import { useState } from 'react'
import { pesosACentavos } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

export function FormularioProducto({ onGuardado }: { onGuardado?: () => void }) {
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [precio, setPrecio] = useState('')
  const [codigo, setCodigo] = useState('')
  const [minimo, setMinimo] = useState('3')

  async function guardar() {
    if (nombre.trim() === '') return
    await repos.productos.guardar({
      nombre: nombre.trim(),
      codigoBarras: codigo.trim() || null,
      costo: pesosACentavos(Number(costo) || 0),
      precio: pesosACentavos(Number(precio) || 0),
      stock: 0,
      stockMinimo: Number(minimo) || 0,
    })
    setNombre(''); setCosto(''); setPrecio(''); setCodigo('')
    onGuardado?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px]" style={{ color: 'var(--tenue)' }}>
        Nombre
        <input
          aria-label="Nombre"
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
          style={campo}
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
        />
      </label>

      <div className="flex gap-2">
        <label className="flex-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Costo
          <input
            aria-label="Costo" inputMode="decimal"
            className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={campo}
            value={costo}
            onChange={(evento) => setCosto(evento.target.value)}
          />
        </label>
        <label className="flex-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Precio
          <input
            aria-label="Precio" inputMode="decimal"
            className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={campo}
            value={precio}
            onChange={(evento) => setPrecio(evento.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <label className="flex-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Código de barras
          <input
            aria-label="Código de barras"
            className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={campo}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </label>
        <label className="w-24 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Mínimo
          <input
            aria-label="Mínimo" inputMode="numeric"
            className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={campo}
            value={minimo}
            onChange={(evento) => setMinimo(evento.target.value)}
          />
        </label>
      </div>

      <Boton variante="principal" onClick={guardar}>Guardar producto</Boton>
    </div>
  )
}
