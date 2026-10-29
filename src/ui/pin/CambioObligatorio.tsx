'use client'

import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Boton } from '@/ui/sistema/Boton'
import { cerrarSesion } from '@/datos/nube/sesion'
import { notificarCambioAcceso } from '@/datos/nube/acceso'
import { CambiarPin } from './CambiarPin'
import '@/ui/sistema/acceso.css'
import './pin.css'

/** Pantalla que tapa todo cuando el PIN es temporal (lo restableció el dueño
 *  o el administrador): hay que elegir uno propio antes de seguir. Es una
 *  barrera de la interfaz; el PIN temporal ya es de un solo uso en la práctica
 *  porque el dueño lo ve una sola vez. */
export function CambioObligatorio({ onListo }: { onListo: () => void }) {
  async function salir() {
    await cerrarSesion()
    notificarCambioAcceso()
  }

  return (
    <main id="contenido" tabIndex={-1} className="f-acceso">
      <Tarjeta como="section" relleno="grande" className="f-acceso-tarjeta">
        <div>
          <h1 className="f-seccion">Elegí tu PIN propio</h1>
          <p className="f-texto">Entraste con un PIN temporal. Por seguridad, cambialo ahora por uno que sólo sepas vos.</p>
        </div>
        <CambiarPin actualEtiqueta="PIN temporal" onListo={onListo} />
        <div className="f-pin-acciones">
          <Boton variante="secundario" onClick={() => void salir()}>Salir</Boton>
        </div>
      </Tarjeta>
    </main>
  )
}
