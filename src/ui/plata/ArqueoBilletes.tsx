'use client'

import { useState } from 'react'
import { BILLETES, cantidadDeBilletes, totalArqueo, type ConteoBilletes } from '@/dominio/billetes'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'

const PESOS = new Intl.NumberFormat('es-AR')
const nombre = (billete: number) => `$${PESOS.format(billete)}`
const centavosDeMonedas = (texto: string) => pesosACentavos(Number(texto.replace(',', '.')) || 0)

/** Contar el cajón billete por billete: cada cambio actualiza el total. */
export function ArqueoBilletes({ onTotal }: { onTotal: (centavos: number) => void }) {
  const [conteo, setConteo] = useState<ConteoBilletes>({})
  const [monedas, setMonedas] = useState('')

  function actualizar(siguiente: ConteoBilletes, siguientesMonedas: string) {
    setConteo(siguiente)
    setMonedas(siguientesMonedas)
    onTotal(totalArqueo(siguiente, centavosDeMonedas(siguientesMonedas)))
  }

  function cambiar(billete: number, cantidad: number) {
    actualizar({ ...conteo, [billete]: Math.max(0, Math.min(9999, Math.floor(cantidad) || 0)) }, monedas)
  }

  const total = totalArqueo(conteo, centavosDeMonedas(monedas))
  const billetes = cantidadDeBilletes(conteo)

  return (
    <section className="fp-arqueo" aria-label="Contar por billetes">
      <ul className="fp-arqueo-lista">
        {BILLETES.map((billete) => {
          const cantidad = conteo[billete] ?? 0
          return (
            <li key={billete} data-con={cantidad > 0 ? 'true' : undefined}>
              <span className="fp-arqueo-billete">{nombre(billete)}</span>
              <span className="fp-arqueo-control">
                <button type="button" aria-label={`Uno menos de ${nombre(billete)}`} disabled={cantidad === 0} onClick={() => cambiar(billete, cantidad - 1)}>−</button>
                <input
                  aria-label={`Billetes de ${nombre(billete)}`}
                  inputMode="numeric"
                  className="tabular"
                  value={cantidad === 0 ? '' : String(cantidad)}
                  placeholder="0"
                  onChange={(evento) => cambiar(billete, Number(evento.target.value.replace(/\D/g, '')))}
                />
                <button type="button" aria-label={`Uno más de ${nombre(billete)}`} onClick={() => cambiar(billete, cantidad + 1)}>+</button>
              </span>
              <span className="fp-arqueo-subtotal tabular">{cantidad > 0 ? formatearPesos(cantidad * billete * 100) : ''}</span>
            </li>
          )
        })}
        <li data-con={monedas !== '' ? 'true' : undefined}>
          <span className="fp-arqueo-billete">Monedas</span>
          <span className="fp-arqueo-control fp-arqueo-monedas">
            <span aria-hidden="true">$</span>
            <input aria-label="Monedas, en pesos" inputMode="decimal" className="tabular" placeholder="0" value={monedas} onChange={(evento) => actualizar(conteo, evento.target.value)} />
          </span>
          <span className="fp-arqueo-subtotal" />
        </li>
      </ul>
      <p className="fp-arqueo-total" role="status">
        <span>{billetes} {billetes === 1 ? 'billete' : 'billetes'}{monedas !== '' ? ' y monedas' : ''}</span>
        <strong className="tabular">{formatearPesos(total)}</strong>
      </p>
    </section>
  )
}
