/** Supabase (PostgREST) devuelve como máximo 1000 filas por consulta y no
 *  avisa cuando corta. Un almacén con más ventas que eso perdía historia al
 *  abrir un aparato nuevo. Acá se piden las páginas hasta que no quede nada. */
export const TAMANO_PAGINA = 1000

/** Cuántos ids entran en un `.in()` sin que la URL se vuelva demasiado larga. */
export const TAMANO_TANDA_IDS = 200

type Respuesta<T> = { data: T[] | null; error: unknown }

export async function todasLasFilas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>,
  tamano = TAMANO_PAGINA,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pedir(desde, desde + tamano - 1)
    if (error) throw error
    const pagina = data ?? []
    filas.push(...pagina)
    if (pagina.length < tamano) return filas
  }
}

export function enTandas<T>(lista: readonly T[], tamano = TAMANO_TANDA_IDS): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < lista.length; i += tamano) tandas.push(lista.slice(i, i + tamano))
  return tandas
}
