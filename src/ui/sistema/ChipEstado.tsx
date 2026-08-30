'use client'

/** El almacenero nunca lee "error" ni "sin conexión": lee que su plata
 *  está anotada. Ámbar mientras falta subir, verde cuando ya subió. */
export function ChipEstado({ pendientes }: { pendientes: boolean }) {
  const color = pendientes ? 'var(--ambar)' : 'var(--verde)'
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{ background: 'var(--chip-fondo)', color: 'var(--tenue)' }}
    >
      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {pendientes ? 'Guardado' : 'Al día'}
    </span>
  )
}
