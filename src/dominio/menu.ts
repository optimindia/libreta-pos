/** El menú de Libreta: qué secciones ve cada uno y en qué orden.
 *  Inicio y Vender son fijas (no se pueden ocultar ni mover): siempre se
 *  llega a vender en un toque. El resto lo acomoda cada negocio. */

export type IdSeccion =
  | 'inicio' | 'vender' | 'fiados' | 'stock' | 'plata' | 'pedidos'
  | 'clientes' | 'historial' | 'operacion' | 'config' | 'cuenta'

export const FIJAS: readonly IdSeccion[] = ['inicio', 'vender']

/** Orden de fábrica: lo de todos los días primero. */
export const ORDEN_INICIAL: readonly IdSeccion[] = [
  'fiados', 'stock', 'plata', 'pedidos', 'clientes', 'historial', 'operacion', 'config', 'cuenta',
]

export type PreferenciasMenu = {
  /** Orden elegido de las secciones movibles. */
  orden: IdSeccion[]
  /** Secciones que el negocio sacó del menú. */
  ocultas: IdSeccion[]
  /** En la PC: barra lateral sólo con íconos. */
  compacta: boolean
}

export const MENU_INICIAL: PreferenciasMenu = { orden: [...ORDEN_INICIAL], ocultas: [], compacta: false }

const MOVIBLES = new Set<IdSeccion>(ORDEN_INICIAL)

/** Limpia lo guardado: descarta ids desconocidos o repetidos y agrega al
 *  final las secciones nuevas que todavía no estaban en el orden. */
export function normalizarMenu(guardado: unknown): PreferenciasMenu {
  const datos = (guardado && typeof guardado === 'object' ? guardado : {}) as Partial<Record<keyof PreferenciasMenu, unknown>>
  const lista = (valor: unknown) => (Array.isArray(valor) ? valor : []).filter((id): id is IdSeccion => MOVIBLES.has(id as IdSeccion))
  const orden = [...new Set(lista(datos.orden))]
  for (const id of ORDEN_INICIAL) if (!orden.includes(id)) orden.push(id)
  return { orden, ocultas: [...new Set(lista(datos.ocultas))], compacta: datos.compacta === true }
}

/** Arma el menú: fijas primero, después las movibles en el orden elegido.
 *  `disponible` filtra las funciones que el negocio tiene apagadas: esas
 *  no aparecen ni como ocultas. */
export function armarMenu(preferencias: PreferenciasMenu, disponible: (id: IdSeccion) => boolean): { visibles: IdSeccion[]; ocultas: IdSeccion[] } {
  const movibles = preferencias.orden.filter(disponible)
  return {
    visibles: [...FIJAS.filter(disponible), ...movibles.filter((id) => !preferencias.ocultas.includes(id))],
    ocultas: movibles.filter((id) => preferencias.ocultas.includes(id)),
  }
}

/** En el celu la barra de abajo es simétrica: Inicio y una sección a la
 *  izquierda, VENDER al centro, otra sección y "Más" a la derecha. Esas dos
 *  secciones son las primeras del menú que eligió el negocio. */
export function pestanasMovil(visibles: readonly IdSeccion[], cantidad = 2): IdSeccion[] {
  return visibles.filter((id) => !FIJAS.includes(id)).slice(0, cantidad)
}

export function alternarOculta(preferencias: PreferenciasMenu, id: IdSeccion): PreferenciasMenu {
  if (!MOVIBLES.has(id)) return preferencias
  const ocultas = preferencias.ocultas.includes(id)
    ? preferencias.ocultas.filter((otra) => otra !== id)
    : [...preferencias.ocultas, id]
  return { ...preferencias, ocultas }
}

/** Sube (-1) o baja (+1) una sección un lugar. */
export function mover(preferencias: PreferenciasMenu, id: IdSeccion, paso: -1 | 1): PreferenciasMenu {
  const orden = [...preferencias.orden]
  const desde = orden.indexOf(id)
  const hasta = desde + paso
  if (desde < 0 || hasta < 0 || hasta >= orden.length) return preferencias
  ;[orden[desde], orden[hasta]] = [orden[hasta], orden[desde]]
  return { ...preferencias, orden }
}
