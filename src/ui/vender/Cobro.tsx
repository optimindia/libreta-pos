'use client'

import { useState } from 'react'
import type { MedioPago } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos, vuelto } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'

const MEDIOS: { medio: MedioPago; texto: string }[] = [
  { medio: 'transferencia', texto: 'Transferencia' },
  { medio: 'qr', texto: 'QR' },
]

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

/** Cobro en efectivo: pregunta con cuánto pagó y calcula el vuelto
 *  antes de confirmar. Los otros medios cobran directo. */
function Efectivo({ total, onCobrar }: { total: number; onCobrar: () => void }) {
  const [pagoCon, setPagoCon] = useState('')
  const entregado = pesosACentavos(Number(pagoCon) || 0)
  const resto = vuelto(entregado, total)

  return (
    <div className="px-5 pt-2">
      <label className="text-[12px]" style={{ color: 'var(--tenue)' }}>
        ¿Con cuánto pagó?
        <input
          aria-label="Con cuánto pagó" inputMode="decimal" autoFocus
          className="tabular mt-1 w-full rounded-xl px-3 py-2.5 text-[16px]"
          style={campo}
          value={pagoCon}
          onChange={(evento) => setPagoCon(evento.target.value)}
        />
      </label>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>Vuelto</span>
        <span className="tabular text-2xl font-bold" style={{ color: 'var(--verde)' }}>
          {resto >= 0 ? formatearPesos(resto) : '—'}
        </span>
      </div>
      {resto < 0 && (
        <p className="mt-1 text-[12px]" style={{ color: 'var(--ambar)' }}>
          Le faltan {formatearPesos(-resto)} para cubrir la venta.
        </p>
      )}

      <Boton
        variante="principal"
        className="mt-3 w-full"
        disabled={pagoCon === '' || resto < 0}
        onClick={onCobrar}
      >
        Cobrar {formatearPesos(total)}
      </Boton>
    </div>
  )
}

export function Cobro({ total, onCobrar }: { total: number; onCobrar: (medio: MedioPago) => void }) {
  const [efectivo, setEfectivo] = useState(false)

  if (efectivo) {
    return <Efectivo total={total} onCobrar={() => onCobrar('efectivo')} />
  }

  return (
    <div className="flex gap-2 px-5 pt-2">
      <Boton
        variante="secundario"
        className="flex-1 !py-2.5 !text-[11.5px]"
        onClick={() => setEfectivo(true)}
      >
        Efectivo
      </Boton>
      {MEDIOS.map(({ medio, texto }) => (
        <Boton
          key={medio}
          variante="secundario"
          className="flex-1 !py-2.5 !text-[11.5px]"
          onClick={() => onCobrar(medio)}
        >
          {texto}
        </Boton>
      ))}
      <Boton variante="fiado" className="flex-1 !py-2.5 !text-[11.5px]" onClick={() => onCobrar('fiado')}>
        Fiado
      </Boton>
    </div>
  )
}