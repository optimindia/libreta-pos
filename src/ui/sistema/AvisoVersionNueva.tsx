'use client'

import { Boton } from './Boton'

/** Banner del sistema F: avisa que hay una versión nueva de Libreta.
 *  El botón es secundario a propósito: el lima es de la acción de la
 *  pantalla (Cobrar, Guardar) y acá no puede competir con ella. */
export function AvisoVersionNueva({ esperandoVenta, onActualizar }: { esperandoVenta: boolean; onActualizar: () => void }) {
  return (
    <div className="f-version-nueva" role="status" aria-live="polite">
      <div className="f-version-nueva-texto">
        <strong>Hay una versión nueva</strong>
        <span>{esperandoVenta ? 'Se actualiza al terminar la venta.' : 'Actualizá cuando no estés cobrando.'}</span>
      </div>
      <Boton variante="secundario" tamano="chico" disabled={esperandoVenta} onClick={onActualizar}>
        Actualizar
      </Boton>
    </div>
  )
}
