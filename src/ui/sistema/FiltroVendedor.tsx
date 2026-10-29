'use client'

import { etiquetaVendedor, SIN_DATO, vendedoresPresentes } from '@/dominio/turno'
import type { UUID } from '@/dominio/tipos'
import { Chip, Chips } from './Chip'

/** Filtro "¿quién vendió?", sólo para el dueño. Se esconde si no hay a quién
 *  distinguir (un solo vendedor o ninguno). `valor` null es "Todos". */
export function FiltroVendedor({
  filas, valor, onCambiar, yo, className,
}: {
  filas: ({ vendidoPor?: UUID | null } | { usuarioId?: UUID | null })[]
  valor: string | null
  onCambiar: (valor: string | null) => void
  yo: { usuarioId?: UUID; nombre?: string | null }
  className?: string
}) {
  const { ids, haySinDato } = vendedoresPresentes(filas)
  const opciones = [...ids, ...(haySinDato ? [SIN_DATO] : [])]
  if (opciones.length < 2) return null
  return (
    <Chips etiqueta="Vendedor" className={className}>
      <Chip activo={valor === null} onClick={() => onCambiar(null)}>Todos</Chip>
      {opciones.map((id) => (
        <Chip key={id} activo={valor === id} onClick={() => onCambiar(id)}>{etiquetaVendedor(id, yo)}</Chip>
      ))}
    </Chips>
  )
}
