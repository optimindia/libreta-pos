import { fileURLToPath } from 'node:url'

// Next pide los plugins como nombres de módulo; el propio se pasa con ruta
// absoluta porque la relativa no se resuelve desde el proyecto.
const mezclasDeColor = fileURLToPath(new URL('./postcss/mezclas-de-color.mjs', import.meta.url))

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    // Va después de Tailwind: trabaja sobre el CSS ya armado.
    [mezclasDeColor]: {},
  },
}

export default config
