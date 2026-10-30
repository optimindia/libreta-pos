'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { hayPendientes } from '@/datos/local/cola'
import { cerrarSesion } from '@/datos/nube/sesion'
import { Boton } from './Boton'
import { Hoja } from './Hoja'
import { IconoSalir } from './iconos'

/** "Cerrar sesión" en el menú, siempre a la vista. Antes de salir confirma,
 *  porque se borra la copia del aparato; si quedan cosas sin subir, lo dice
 *  claro para que no se pierdan sin querer. */
export function CerrarSesion({ estilo, alAbrir }: { estilo: 'lateral' | 'fila'; alAbrir?: () => void }) {
  const [abierta, setAbierta] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const sinSubir = useLiveQuery(() => hayPendientes(), [], false)

  const salir = async () => {
    setSaliendo(true)
    try {
      await cerrarSesion()
    } finally {
      setSaliendo(false)
      setAbierta(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={estilo === 'lateral' ? 'f-nav-item f-nav-salir' : 'f-fila-accion f-fila-salir'}
        aria-label={estilo === 'lateral' ? 'Cerrar sesión' : undefined}
        data-tip={estilo === 'lateral' ? 'Cerrar sesión' : undefined}
        onClick={() => { alAbrir?.(); setAbierta(true) }}
      >
        <span className="f-nav-icono"><IconoSalir /></span>
        <span className="f-nav-texto">{estilo === 'lateral' ? 'Salir' : 'Cerrar sesión'}</span>
      </button>

      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Cerrar sesión?" ancho="angosto">
        <div className="f-salir">
          <p className="f-texto">
            Se cierra tu cuenta en este aparato y se borra la copia guardada acá. Tus datos siguen en la nube:
            entrás de nuevo con tu teléfono y tu PIN.
          </p>
          {sinSubir && (
            <p className="f-salir-aviso" role="alert">
              Hay cambios que todavía no se subieron a la nube. Si cerrás ahora se pierden. Conectate a internet y esperá a que diga «Guardado».
            </p>
          )}
          <div className="f-salir-acciones">
            <Boton variante="secundario" onClick={() => setAbierta(false)}>Seguir usando</Boton>
            <Boton variante="cuidado" disabled={saliendo} onClick={() => void salir()}>
              {saliendo ? 'Cerrando…' : sinSubir ? 'Cerrar igual' : 'Cerrar sesión'}
            </Boton>
          </div>
        </div>
      </Hoja>
    </>
  )
}
