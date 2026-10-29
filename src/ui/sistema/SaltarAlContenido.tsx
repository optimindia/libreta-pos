/** Primer enlace de la página (2.4.1): sólo se ve al recibir el foco con el
 *  teclado y lleva al <main id="contenido"> sin pasar por todo el menú. */
export function SaltarAlContenido() {
  return <a href="#contenido" className="f-saltar">Saltar al contenido</a>
}
