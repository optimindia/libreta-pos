'use client'

import { useState } from 'react'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { conPuntos, soloDigitos } from '@/dominio/cobro'
import type { Centavos } from '@/dominio/tipos'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton } from '@/ui/sistema/Boton'

/** Montos que se cobran seguido sin producto cargado: un toque y listo. */
const RAPIDOS = [500, 1000, 2000, 5000]

/** Cobrar algo que no está cargado: se escribe el importe y entra al
 *  ticket como "Varios". */
export function HojaMontoLibre({ onSumar, onCerrar }: { onSumar: (monto: Centavos) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState('')
  const pesos = Number(texto)
  const valido = texto !== '' && Number.isFinite(pesos) && pesos > 0

  function sumar(evento: React.FormEvent) {
    evento.preventDefault()
    if (valido) onSumar(pesosACentavos(pesos))
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Monto libre" etiquetaCerrar="Cancelar el monto libre" ancho="angosto">
      <form className="f-cobro" onSubmit={sumar}>
        <p className="f-hoja-ayuda">Para lo que no está cargado: fiambre al peso, una changa, una recarga. Entra al ticket como <b>Varios</b>.</p>
        <label className="f-cobro-te-dan f-precio">
          <span className="f-cobro-rotulo">Importe</span>
          <span className="f-cobro-monto">
            <span aria-hidden="true">$</span>
            <input
              aria-label="Importe del monto libre"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              className="f-plata"
              value={conPuntos(texto)}
              onChange={(evento) => setTexto(soloDigitos(evento.target.value).slice(0, 9))}
            />
          </span>
        </label>
        <div className="f-billetes" role="group" aria-label="Montos rápidos">
          {RAPIDOS.map((monto) => (
            <button key={monto} type="button" className="f-billete f-plata" aria-pressed={texto === String(monto)} onClick={() => setTexto(String(monto))}>
              {formatearPesos(monto * 100)}
            </button>
          ))}
        </div>
        <Boton type="submit" variante="principal" tamano="grande" ancho disabled={!valido}>
          {valido ? `Sumar ${formatearPesos(pesosACentavos(pesos))}` : 'Escribí el importe'}
        </Boton>
      </form>
    </Hoja>
  )
}
