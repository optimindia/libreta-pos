/** Entrega un archivo al navegador. El CSV ya trae su propio BOM (armarCsv):
 *  acá no se agrega nada para no duplicarlo. */
export function descargarArchivo(nombre: string, contenido: string, tipo: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}
