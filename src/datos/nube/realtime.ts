import { cliente } from './cliente'

/** Suscribe los cambios de las tablas del negocio. El RLS aplica en
 *  Realtime: el canal sólo recibe los eventos de las filas que el usuario
 *  autenticado puede ver — es decir, las de su negocio.
 *
 *  El evento no trae los datos: es sólo el timbre. Quien escucha decide
 *  qué hacer (la bajada incremental trae lo nuevo completa y segura). */
export function escucharCambios(
  tablas: string[],
  alCambiar: () => void,
): (() => void) | null {
  if (!cliente) return null

  let canal = cliente.channel('libreta-cambios')
  for (const tabla of tablas) {
    canal = canal.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabla },
      () => alCambiar(),
    )
  }
  canal.subscribe()

  return () => {
    void canal.unsubscribe()
  }
}
