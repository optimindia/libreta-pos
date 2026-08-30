export type Tema = 'claro' | 'oscuro'
export type PreferenciaTema = Tema | 'auto'

const DESDE = 7
const HASTA = 19

/** En automático el tema sigue la jornada del almacén: claro mientras
 *  pega el sol en el mostrador, oscuro en el turno noche. */
export function temaInicial(preferencia: PreferenciaTema, hora: number): Tema {
  if (preferencia !== 'auto') return preferencia
  return hora >= DESDE && hora < HASTA ? 'claro' : 'oscuro'
}
