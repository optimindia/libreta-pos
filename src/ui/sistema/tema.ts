export type Tema = 'claro' | 'oscuro'
export type PreferenciaTema = Tema | 'auto'

const DESDE = 7
const HASTA = 19
const CLAVE = 'libreta-preferencia-tema'

/** En automático el tema sigue la jornada del almacén: claro mientras
 *  pega el sol en el mostrador, oscuro en el turno noche. */
export function temaInicial(preferencia: PreferenciaTema, hora: number): Tema {
  if (preferencia !== 'auto') return preferencia
  return hora >= DESDE && hora < HASTA ? 'claro' : 'oscuro'
}

export function leerPreferenciaTema(): PreferenciaTema {
  if (typeof window === 'undefined') return 'auto'
  const guardada = window.localStorage.getItem(CLAVE)
  return guardada === 'claro' || guardada === 'oscuro' || guardada === 'auto' ? guardada : 'auto'
}

export function guardarPreferenciaTema(preferencia: PreferenciaTema): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(CLAVE, preferencia)
}

export function aplicarTema(preferencia: PreferenciaTema, ahora: Date = new Date()): Tema {
  const tema = temaInicial(preferencia, ahora.getHours())
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.tema = tema
    // La barra de estado del celu (y la de la ventana instalada) acompaña
    // al tema elegido, no al del sistema.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = tema === 'oscuro' ? '#0E1513' : '#F1F4F2'
    })
  }
  return tema
}
