'use client'

import type { MedioPago } from '@/dominio/tipos'
import { Boton } from '@/ui/sistema/Boton'

const MEDIOS: { medio: MedioPago; texto: string }[] = [
  { medio: 'efectivo', texto: 'Efectivo' },
  { medio: 'transferencia', texto: 'Transferencia' },
  { medio: 'qr', texto: 'QR' },
]

export function Cobro({ onCobrar }: { onCobrar: (medio: MedioPago) => void }) {
  return (
    <div className="flex gap-2 px-5 pt-2">
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
