'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MedioCaja, TipoMovimientoCaja } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { Segmentado, type OpcionSegmentado } from '@/ui/sistema/Segmentado'
import { IconoCerrar } from '@/ui/sistema/iconos'

const MEDIOS: OpcionSegmentado<MedioCaja>[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transf.', nombre: 'Transferencia' },
  { valor: 'qr', texto: 'QR' },
]

const TIPOS: OpcionSegmentado<TipoMovimientoCaja>[] = [
  { valor: 'salida', texto: 'Salida' },
  { valor: 'entrada', texto: 'Entrada' },
]

const SUGERENCIAS = ['Pago a proveedor', 'Retiro del dueño', 'Cambio', 'Otro']

/** Movimientos que no son ventas pero explican por qué cambió el cajón. */
export function MovimientosCaja() {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoMovimientoCaja>('salida')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<MedioCaja>('efectivo')
  const [aviso, setAviso] = useState<string | null>(null)
  const movimientos = useLiveQuery(() => repos.movimientosCaja.todos(), [], [])

  const entradas = (movimientos ?? []).reduce((total, movimiento) => total + (movimiento.tipo === 'entrada' ? movimiento.monto : 0), 0)
  const salidas = (movimientos ?? []).reduce((total, movimiento) => total + (movimiento.tipo === 'salida' ? movimiento.monto : 0), 0)

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const montoCentavos = pesosACentavos(pesosDeTexto(monto))
    if (concepto.trim().length < 2 || montoCentavos <= 0) {
      setAviso('Completá un concepto y un monto mayor a cero.')
      return
    }
    await repos.movimientosCaja.registrar({ tipo, concepto, monto: montoCentavos, medioPago })
    setConcepto('')
    setMonto('')
    setAviso(null)
    setAbierto(false)
  }

  async function eliminar(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar este movimiento?')) return
    await repos.movimientosCaja.eliminar(id)
  }

  return (
    <div className="fp-movimientos">
      <div className="fp-movimientos-cabeza">
        <div>
          <h3 className="f-renglon-texto">Movimientos manuales</h3>
          <p className="f-dato">Solo los de efectivo impactan el cierre.</p>
        </div>
        <Boton variante="secundario" tamano="chico" className="fp-boton-44" onClick={() => setAbierto(true)}>
          Agregar
        </Boton>
      </div>

      <div className="fp-pareja">
        <div className="fp-dato-caja" data-tono="verde"><span>Entradas</span><b className="f-plata f-plata-16">{formatearPesos(entradas)}</b></div>
        <div className="fp-dato-caja" data-tono="ambar"><span>Salidas</span><b className="f-plata f-plata-16">{formatearPesos(salidas)}</b></div>
      </div>

      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Registrar movimiento">
        <form className="fp-formulario" onSubmit={(evento) => void guardar(evento)}>
          <p className="f-hoja-ayuda">Anotá entradas o salidas que no vienen de una venta.</p>
          <Segmentado etiqueta="Tipo de movimiento" opciones={TIPOS} valor={tipo} onCambiar={setTipo} />
          <Segmentado etiqueta="Medio del movimiento" opciones={MEDIOS} valor={medioPago} onCambiar={setMedioPago} />
          <p className="fp-impacto" data-tono={tipo === 'entrada' ? 'verde' : 'ambar'}>
            {tipo === 'entrada' ? 'Esta entrada va a sumar al saldo de caja.' : 'Esta salida va a descontarse del saldo de caja.'}
          </p>
          <label className="f-campo">
            <span>Concepto <em>obligatorio</em></span>
            <input aria-label="Concepto del movimiento" placeholder="Ej. Pago a proveedor" className="f-entrada" list="conceptos-caja" value={concepto} onChange={(evento) => setConcepto(evento.target.value)} />
            <datalist id="conceptos-caja">{SUGERENCIAS.map((sugerencia) => <option key={sugerencia} value={sugerencia} />)}</datalist>
          </label>
          <label className="f-campo">
            <span>Monto <em>importe en pesos</em></span>
            <span className="fp-prefijo">
              <span aria-hidden="true">$</span>
              <input aria-label="Monto del movimiento" inputMode="decimal" placeholder="Ej. 15.000" className="f-entrada fp-entrada-grande tabular" value={monto} onChange={(evento) => setMonto(evento.target.value)} />
            </span>
          </label>
          {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
          <Boton variante="principal" tamano="grande" ancho type="submit">Guardar movimiento</Boton>
        </form>
      </Hoja>

      {(movimientos ?? []).length > 0 && (
        <ul className="fp-lista">
          {(movimientos ?? []).slice(0, 8).map((movimiento) => (
            <li key={movimiento.id} className="f-renglon">
              <span className="f-renglon-cuerpo">
                <span className="f-renglon-titulo">{movimiento.concepto}</span>
                <span className="f-renglon-detalle">{new Date(movimiento.fecha).toLocaleDateString('es-AR')} · {movimiento.medioPago}</span>
              </span>
              <span className="f-renglon-fin" data-tono={movimiento.tipo === 'salida' ? 'ambar' : 'verde'}>{formatearPesos(movimiento.tipo === 'salida' ? -movimiento.monto : movimiento.monto)}</span>
              <button type="button" aria-label={`Eliminar movimiento ${movimiento.concepto}`} className="f-icono-boton" onClick={() => void eliminar(movimiento.id)}><IconoCerrar /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
