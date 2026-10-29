'use client'

import { useId, useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { pesosACentavos } from '@/dominio/dinero'
import { conPuntos, soloDigitos } from '@/dominio/cobro'
import { repos } from '@/datos/local/repos'
import { Hoja } from '@/ui/sistema/Hoja'
import { useRol } from '@/ui/sistema/usoRol'
import { db } from '@/datos/local/db'
import { puede, rolDe } from '@/dominio/roles'
import { Boton } from '@/ui/sistema/Boton'

/** Un producto cargado sin precio no se puede vender a $0. En vez de
 *  mandar al almacenero a Stock, se lo pide acá mismo: escribe el precio,
 *  queda guardado para la próxima y el producto entra al ticket.
 *  Un vendedor no cambia la ficha (la base se lo rechaza): su precio vale
 *  sólo para esta venta. */
export function PonerPrecio({
  producto,
  onCancelar,
  onListo,
}: {
  producto: Producto
  onCancelar: () => void
  onListo: (conPrecio: Producto) => void
}) {
  const idError = useId()
  const [pesos, setPesos] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El texto se ajusta cuando se conoce el rol; lo que se hace al guardar se
  // decide con el rol leído en ese momento.
  const rol = useRol()
  const guardaFicha = rol === null || puede(rol, 'editarProductos')

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault()
    const precio = pesosACentavos(Number(pesos))
    if (!pesos || precio <= 0) {
      setError('Escribí un precio mayor a $0.')
      return
    }
    setGuardando(true)
    try {
      const esDeLaFicha = puede(rolDe((await db.negocio.get('unico'))?.rol), 'editarProductos')
      onListo(esDeLaFicha ? await repos.productos.guardar({ ...producto, precio }) : { ...producto, precio })
    } catch {
      setError('No se pudo guardar el precio. Probá de nuevo.')
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta onCerrar={onCancelar} titulo="Ponele precio" ancho="angosto">
      <form className="f-cobro" onSubmit={(evento) => void guardar(evento)}>
        <p className="f-hoja-ayuda"><b>{producto.nombre}</b> no tiene precio todavía. {guardaFicha ? 'Lo guardamos para las próximas ventas.' : 'Vale sólo para esta venta: el precio fijo lo pone el dueño.'}</p>
        <label className="f-cobro-te-dan f-precio">
          <span className="f-cobro-rotulo">Precio de venta</span>
          <span className="f-cobro-monto">
            <span aria-hidden="true">$</span>
            <input
              aria-label={`Precio de ${producto.nombre}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? idError : undefined}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              className="f-plata"
              value={conPuntos(pesos)}
              onChange={(evento) => { setPesos(soloDigitos(evento.target.value)); setError(null) }}
            />
          </span>
        </label>
        {error && <p id={idError} className="f-aviso" role="alert">{error}</p>}
        <Boton type="submit" variante="principal" tamano="grande" ancho disabled={guardando}>
          {guardando ? 'Guardando…' : guardaFicha ? 'Guardar y agregar a la venta' : 'Agregar a la venta'}
        </Boton>
      </form>
    </Hoja>
  )
}
