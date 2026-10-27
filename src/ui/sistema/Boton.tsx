// Contorno firme y sombra dura: el botón se ve como botón aun en un monitor
// que aplasta los tonos parecidos. Al apretarlo se hunde (ver mosaico.css).
const RELIEVE = { border: '2px solid var(--contorno)', boxShadow: 'var(--sombra-pop-chica)' } as const

const VARIANTES = {
  principal: { background: 'var(--verde)', color: 'var(--verde-texto)', ...RELIEVE },
  secundario: { background: 'var(--hueso-2)', color: 'var(--tinta)', ...RELIEVE },
  fiado: { background: 'var(--ambar-fondo)', color: 'var(--ambar)', ...RELIEVE },
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
      className={`libreta-button touch-manipulation rounded-2xl px-5 py-3.5 text-base font-bold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--contorno)] disabled:pointer-events-none disabled:opacity-40 ${className}`}
    />
  )
}
