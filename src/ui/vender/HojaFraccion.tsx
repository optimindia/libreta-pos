'use client'

import { useState } from 'react'
import type { Centavos, Producto } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { conPuntos, soloDigitos } from '@/dominio/cobro'
import { formatearCantidad, importePorCantidad, porMonto, porUnidad, unidadDe } from '@/dominio/cantidad'
import { precioVigente } from '@/dominio/ticket'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton } from '@/ui/sistema/Boton'
import { Segmentado } from '@/ui/sistema/Segmentado'

type Modo = 'cantidad' | 'plata'

const RAPIDOS_KG = [100, 250, 500, 1000]
const RAPIDOS_L = [250, 500, 1000, 2000]
const RAPIDOS_PLATA = [500, 1000, 2000, 5000]

/** Vender por kilo o por litro, como se pide en el mostrador: "medio kilo"
 *  (por cantidad) o "dame $500" (por plata, se cobra justo eso y la app
 *  dice cuánto pesar). Se escribe en gramos o mililitros: es lo que muestra
 *  la balanza y entra con el teclado numérico del celu. */
export function HojaFraccion({
  producto,
  maximo,
  inicial,
  onSumar,
  onCerrar,
}: {
  producto: Producto
  /** Lo que se puede vender (en kilos o litros). */
  maximo: number
  /** La cantidad que ya lleva el ticket, para corregirla. */
  inicial?: number
  onSumar: (cantidad: number, precio: Centavos) => void
  onCerrar: () => void
}) {
  const unidad = unidadDe(producto)
  const chica = unidad === 'kg' ? 'g' : 'ml'
  const nombreChica = unidad === 'kg' ? 'Gramos' : 'Mililitros'
  const precio = precioVigente(producto)
  const [modo, setModo] = useState<Modo>('cantidad')
  const [gramos, setGramos] = useState(inicial ? String(Math.round(inicial * 1000)) : '')
  const [pesos, setPesos] = useState('')

  const cantidadPedida = Number(gramos) / 1000
  const porCantidad = modo === 'cantidad' && gramos !== '' && cantidadPedida > 0
    ? { cantidad: cantidadPedida, precio }
    : null
  const porPlata = modo === 'plata' && pesos !== '' ? porMonto(precio, pesosACentavos(Number(pesos))) : null
  const elegido = modo === 'cantidad' ? porCantidad : porPlata
  const pasado = elegido !== null && elegido.cantidad > maximo
  const valido = elegido !== null && !pasado
  const importe = elegido ? importePorCantidad(elegido.precio, elegido.cantidad) : 0

  function sumar(evento: React.FormEvent) {
    evento.preventDefault()
    if (valido && elegido) onSumar(elegido.cantidad, elegido.precio)
  }

  const textoCantidad = (cantidad: number) => formatearCantidad(cantidad, unidad)

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={producto.nombre} etiquetaCerrar={`Cancelar ${producto.nombre}`} ancho="angosto">
      <form className="f-cobro f-fraccion" onSubmit={sumar}>
        <p className="f-fraccion-precio">
          <b className="f-plata">{formatearPesos(precio)}</b> {porUnidad(unidad)}
          <span> · quedan {textoCantidad(maximo)}</span>
        </p>

        <Segmentado
          etiqueta="Cómo lo pide"
          opciones={[
            { valor: 'cantidad' as const, texto: unidad === 'kg' ? 'Por peso' : 'Por cantidad', nombre: unidad === 'kg' ? 'Por peso' : 'Por cantidad' },
            { valor: 'plata' as const, texto: 'Por plata', nombre: 'Por plata' },
          ]}
          valor={modo}
          onCambiar={setModo}
        />

        {modo === 'cantidad' ? (
          <>
            <label className="f-cobro-te-dan f-precio">
              <span className="f-cobro-rotulo">{nombreChica}</span>
              <span className="f-cobro-monto">
                <input
                  aria-label={`${nombreChica} de ${producto.nombre}`}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="0"
                  className="f-plata"
                  value={conPuntos(gramos)}
                  onChange={(evento) => setGramos(soloDigitos(evento.target.value).slice(0, 6))}
                />
                <span className="f-fraccion-sufijo" aria-hidden="true">{chica}</span>
              </span>
            </label>
            <div className="f-billetes" role="group" aria-label="Cantidades rápidas">
              {(unidad === 'kg' ? RAPIDOS_KG : RAPIDOS_L).map((rapido) => (
                <button key={rapido} type="button" className="f-billete" aria-pressed={gramos === String(rapido)} onClick={() => setGramos(String(rapido))}>
                  {textoCantidad(rapido / 1000)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="f-cobro-te-dan f-precio">
              <span className="f-cobro-rotulo">Plata que pide</span>
              <span className="f-cobro-monto">
                <span aria-hidden="true">$</span>
                <input
                  aria-label={`Plata de ${producto.nombre}`}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="0"
                  className="f-plata"
                  value={conPuntos(pesos)}
                  onChange={(evento) => setPesos(soloDigitos(evento.target.value).slice(0, 8))}
                />
              </span>
            </label>
            <div className="f-billetes" role="group" aria-label="Montos rápidos">
              {RAPIDOS_PLATA.map((monto) => (
                <button key={monto} type="button" className="f-billete f-plata" aria-pressed={pesos === String(monto)} onClick={() => setPesos(String(monto))}>
                  {formatearPesos(monto * 100)}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="f-fraccion-resultado" aria-live="polite" data-estado={elegido === null ? 'vacio' : pasado ? 'error' : 'listo'}>
          {elegido === null ? (
            <span>{modo === 'cantidad' ? `Escribí cuántos ${chica === 'g' ? 'gramos' : 'mililitros'} o tocá uno de arriba.` : 'Escribí la plata o tocá un monto de arriba.'}</span>
          ) : pasado ? (
            <span>No alcanza: quedan {textoCantidad(maximo)}.</span>
          ) : modo === 'cantidad' ? (
            <span>Son <b>{formatearPesos(importe)}</b></span>
          ) : (
            <span>{unidad === 'kg' ? 'Pesá' : 'Serví'} <b>{textoCantidad(elegido.cantidad)}</b></span>
          )}
        </div>

        <Boton type="submit" variante="principal" tamano="grande" ancho disabled={!valido}>
          {valido && elegido ? `Sumar ${textoCantidad(elegido.cantidad)} · ${formatearPesos(importe)}` : 'Sumar al ticket'}
        </Boton>
      </form>
    </Hoja>
  )
}
