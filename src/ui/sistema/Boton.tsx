const VARIANTES = {
  principal: { background: 'var(--verde)', color: 'var(--verde-texto)', border: 'none' },
  secundario: { background: 'var(--hueso-2)', color: 'var(--tinta)', border: '1px solid var(--linea)' },
  fiado: { background: 'var(--ambar-fondo)', color: 'var(--ambar)', border: '1px solid var(--ambar)' },
} as const

export function Boton({
  variante = 'principal',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES
}) {
  return (
    <button
      {...props}
      style={{ ...VARIANTES[variante], ...props.style }}
      className={`rounded-2xl px-4 py-4 text-base font-semibold active:opacity-80 disabled:opacity-40 ${className}`}
    />
  )
}
