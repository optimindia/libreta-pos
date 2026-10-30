'use client'

import { useId, useState } from 'react'
import type { Centavos } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { conPuntos, soloDigitos } from '@/dominio/cobro'
import { importeDescuento, type Descuento } from '@/dominio/ventaAbierta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton } from '@/ui/sistema/Boton'
import { Segmentado } from '@/ui/sistema/Segmentado'

type Tipo = Descuento['tipo']

const OPCIONES = [
  { valor: 'porcentaje' as const, texto: '%', nombre: 'Porcentaje' },
  { valor: 'pesos' as const, texto: '$', nombre: 'Pesos' },
]

function aTexto(descuento: Descuento | null): string {
  if (!descuento) return ''
  return String(descuento.tipo === 'pesos' ? Math.round(descuento.valor / 100) : descuento.valor)
}

/** Pone o saca un descuento, a un renglón o a toda la venta. Muestra cómo
 *  queda antes de aplicarlo. */
export function HojaDescuento({
  titulo,
  base,
  inicial,
  onAplicar,
  onCerrar,
}: {
  titulo: string
  /** Lo que se descuenta: el subtotal del renglón o el total de la venta. */
  base: Centavos
  inicial: Descuento | null
  onAplicar: (descuento: Descuento | null) => void
  onCerrar: () => void
}) {
  const idError = useId()
  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? 'porcentaje')
  const [texto, setTexto] = useState(aTexto(inicial))

  const numero = Number(texto)
  const descuento: Descuento | null = texto === '' || !Number.isFinite(numero) || numero <= 0
    ? null
    : tipo === 'pesos' ? { tipo, valor: pesosACentavos(numero) } : { tipo, valor: numero }
  const pasado = tipo === 'porcentaje' ? numero > 99 : descuento !== null && descuento.valor >= base
  const valido = descuento !== null && !pasado
  const restado = valido ? importeDescuento(base, descuento) : 0

  function aplicar(evento: React.FormEvent) {
    evento.preventDefault()
    if (valido) onAplicar(descuento)
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={titulo} etiquetaCerrar="Cancelar el descuento" ancho="angosto">
      <form className="f-cobro" onSubmit={aplicar}>
        <Segmentado etiqueta="Tipo de descuento" opciones={OPCIONES} valor={tipo} onCambiar={(nuevo) => { setTipo(nuevo); setTexto('') }} />
        <label className="f-cobro-te-dan f-precio">
          <span className="f-cobro-rotulo">{tipo === 'porcentaje' ? 'Porcentaje a descontar' : 'Pesos a descontar'}</span>
          <span className="f-cobro-monto">
            <span aria-hidden="true">{tipo === 'porcentaje' ? '%' : '$'}</span>
            <input
              aria-label={tipo === 'porcentaje' ? 'Porcentaje de descuento' : 'Pesos de descuento'}
              aria-invalid={pasado ? true : undefined}
              aria-describedby={pasado ? idError : undefined}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              className="f-plata"
              value={tipo === 'pesos' ? conPuntos(texto) : texto}
              onChange={(evento) => setTexto(soloDigitos(evento.target.value).slice(0, 9))}
            />
          </span>
        </label>
        {pasado && (
          <p id={idError} className="f-aviso" role="alert">
            {tipo === 'porcentaje' ? 'El descuento no puede pasar del 99%.' : `El descuento tiene que ser menor a ${formatearPesos(base)}.`}
          </p>
        )}
        <p className="f-hoja-ayuda" aria-live="polite">
          {valido ? <>Se descuentan <b>{formatearPesos(restado)}</b>. Queda en <b>{formatearPesos(base - restado)}</b>.</> : <>Ahora son <b>{formatearPesos(base)}</b>.</>}
        </p>
        <Boton type="submit" variante="principal" tamano="grande" ancho disabled={!valido}>Aplicar descuento</Boton>
        {inicial && <Boton variante="secundario" ancho onClick={() => onAplicar(null)}>Quitar descuento</Boton>}
      </form>
    </Hoja>
  )
}
