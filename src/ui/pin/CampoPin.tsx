'use client'

/** Campo de PIN de 6 números: sólo dígitos, sin mostrar lo que se escribe. */
export function CampoPin({
  etiqueta,
  ayuda = '6 números',
  valor,
  onCambio,
  nuevo = false,
  autoFocus = false,
}: {
  etiqueta: string
  ayuda?: string
  valor: string
  onCambio: (valor: string) => void
  /** true = PIN que se está eligiendo (el administrador de contraseñas no lo autocompleta). */
  nuevo?: boolean
  autoFocus?: boolean
}) {
  return (
    <label className="f-campo">
      <span>{etiqueta} <em>{ayuda}</em></span>
      <input
        className="f-entrada"
        inputMode="numeric"
        type="password"
        autoComplete={nuevo ? 'new-password' : 'current-password'}
        maxLength={6}
        value={valor}
        onChange={(evento) => onCambio(evento.target.value.replace(/\D/g, '').slice(0, 6))}
        autoFocus={autoFocus}
        required
      />
    </label>
  )
}
