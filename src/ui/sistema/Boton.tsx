const VARIANTES = {
  principal: { background: 'var(--verde)', color: 'var(--verde-texto)', border: 'none' },
  secundario: { background: 'var(--hueso-2)', color: 'var(--tinta)', border: '1px solid var(--linea)' },
  fiado: { background: 'var(--ambar-fondo)', color: 'var(--ambar)', border: '1px solid var(--ambar)' },
} as const

export function Boton({
  variante = 'principal',
  className = '',
  type = 'button',
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES
}) {
  return (
    <button
      type={type}
      {...props}
      style={{ ...VARIANTES[variante], ...style }}
      className={`libreta-button touch-manipulation rounded-xl px-4 py-3 text-sm font-semibold transition-opacity active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--verde)] disabled:pointer-events-none disabled:opacity-40 ${className}`}
    />
  )
}
