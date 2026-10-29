/** Región viva que ya está en la página antes de que cambie el texto: los
 *  lectores de pantalla anuncian de forma fiable lo que se escribe en una
 *  región existente, no lo que aparece junto con su propio contenedor
 *  (4.1.3). Es invisible; el cartel visible va aparte y oculto al lector. */
export function AnuncioVivo({ mensaje, nombre }: { mensaje: string; nombre: string }) {
  return (
    <div className="f-sr" role="status" aria-live="polite" aria-atomic="true" data-anuncio={nombre}>
      {mensaje}
    </div>
  )
}
