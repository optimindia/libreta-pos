'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { Boton, clasesBoton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { IconoCobrar, IconoFiados, IconoStock, IconoVender } from '@/ui/sistema/iconos'

const CLAVE = 'libreta.bienvenida.'

const PASOS = [
  { Icono: IconoStock, titulo: 'Cargá tus productos', texto: 'Con el lector de códigos, a mano o importando una lista. El precio y lo que te cuesta, y Libreta calcula cuánto ganás.' },
  { Icono: IconoVender, titulo: 'Vendé en dos toques', texto: 'Tocá o escaneá lo que se lleva y cobrá en efectivo, transferencia, QR o fiado. El stock baja solo.' },
  { Icono: IconoFiados, titulo: 'El fiado, en orden', texto: 'Quién te debe, desde cuándo y un aviso por WhatsApp en un toque. Nada de cuaderno.' },
  { Icono: IconoCobrar, titulo: 'Cerrá el día tranquilo', texto: 'Al final, contás la caja y Libreta te dice si cuadra. En Plata ves lo que ganaste de verdad.' },
] as const

function vista(clave: string): boolean {
  try { return window.localStorage.getItem(clave) === '1' } catch { return true }
}

const nada = () => () => {}

/** La primera vez que el dueño entra a una cuenta nueva (sin productos ni
 *  ventas): cuatro pasos para entender la app y un botón para empezar. */
export function Bienvenida({ negocioId, nombre }: { negocioId: string; nombre: string }) {
  const clave = `${CLAVE}${negocioId}`
  const yaVista = useSyncExternalStore(nada, () => vista(clave), () => true)
  const [cerrada, setCerrada] = useState(false)
  const [paso, setPaso] = useState(0)
  if (yaVista || cerrada) return null

  function cerrar() {
    try { window.localStorage.setItem(clave, '1') } catch { /* sin almacenamiento: se vuelve a ver la próxima */ }
    setCerrada(true)
  }

  const actual = PASOS[paso]
  const ultimo = paso === PASOS.length - 1
  return (
    <Hoja abierta onCerrar={cerrar} titulo={`¡Bienvenido a Libreta${nombre ? `, ${nombre}` : ''}!`} ancho="angosto" etiquetaCerrar="Saltar la bienvenida">
      <div className="fi-bienvenida">
        <div className="fi-bienvenida-paso" key={paso}>
          <span className="fi-bienvenida-icono" aria-hidden="true"><actual.Icono /></span>
          <h3>{actual.titulo}</h3>
          <p>{actual.texto}</p>
        </div>
        <div className="fi-bienvenida-puntos" role="tablist" aria-label="Pasos de la bienvenida">
          {PASOS.map((item, i) => (
            <button key={item.titulo} type="button" role="tab" aria-selected={i === paso} aria-label={`Paso ${i + 1}: ${item.titulo}`} onClick={() => setPaso(i)}>
              <span />
            </button>
          ))}
        </div>
        {ultimo ? (
          <div className="fi-bienvenida-acciones">
            <Link href="/stock" className={clasesBoton('principal')} data-tamano="grande" onClick={cerrar}>Cargar mis productos</Link>
            <Boton variante="secundario" onClick={cerrar}>Mirar la app primero</Boton>
          </div>
        ) : (
          <div className="fi-bienvenida-acciones">
            <Boton variante="principal" tamano="grande" onClick={() => setPaso(paso + 1)}>Siguiente</Boton>
            <button type="button" className="fi-bienvenida-saltar" onClick={cerrar}>Saltar</button>
          </div>
        )}
      </div>
    </Hoja>
  )
}
