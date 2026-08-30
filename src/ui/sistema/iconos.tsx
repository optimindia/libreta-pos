/** Todos con el mismo grosor de línea y las mismas puntas redondeadas.
 *  Nunca emojis: cada sistema los dibuja distinto y no son de la marca. */
const base = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

export const IconoVender = () => (
  <svg {...base}>
    <path d="M3 4h2l2.5 11h10L20 7H6.5" />
    <circle cx="9.5" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
  </svg>
)

export const IconoFiados = () => (
  <svg {...base}>
    <path d="M5 3h14v18l-7-3.5L5 21z" />
    <path d="M9 8h6M9 12h4" />
  </svg>
)

export const IconoStock = () => (
  <svg {...base}>
    <path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16z" />
    <path d="M3 8l9 4.5L21 8M12 12.5V21" />
  </svg>
)

export const IconoPlata = () => (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
