// Textos que se repiten en varias pantallas. Voseo rioplatense, sin
// tecnicismos: un verbo por acción ("Agregar" para clientes y pedidos,
// "Cargar" para productos) y la misma frase para el mismo problema.

export const TEXTOS = {
  // Acciones
  agregarCliente: 'Agregar cliente',
  agregarPedido: 'Agregar pedido',
  cargarProducto: 'Cargar producto',
  irAVender: 'Ir a vender',
  reintentar: 'Reintentar',
  // Cargas
  preparando: 'Preparando la pantalla…',
  cargandoCuentas: 'Trayendo las cuentas…',
  // Errores
  probarDeNuevo: 'Probá de nuevo.',
  revisarSenal: 'Revisá la señal y probá de nuevo.',
  // Sincronización, dicho como lo entiende el almacenero
  alDia: 'Todo al día',
  cambiosSinEnviar: 'Hay cambios sin enviar',
  avisoEliminado: 'Los demás dispositivos lo van a ver en unos minutos.',
} as const

/** "No se pudo guardar el cliente. Probá de nuevo." */
export function noSePudo(accion: string, cosa: string): string {
  return `No se pudo ${accion} ${cosa}. ${TEXTOS.probarDeNuevo}`
}
