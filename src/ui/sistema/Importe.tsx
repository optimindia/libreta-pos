import { formatearPesos } from '@/dominio/dinero'

const TAMANOS = {
  chico: 'text-sm font-semibold',
  normal: 'text-lg font-bold',
  grande: 'text-4xl font-bold',
} as const

export function Importe({
  centavos,
  tamaño = 'normal',
  className = '',
  style,
}: {
  centavos: number
  tamaño?: keyof typeof TAMANOS
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={`tabular ${TAMANOS[tamaño]} ${className}`} style={style}>
      {formatearPesos(centavos)}
    </span>
  )
}
