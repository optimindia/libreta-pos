'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MedioCaja, TipoMovimientoCaja } from '@/dominio/tipos'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoMovimiento } from '@/ui/sistema/iconos'
import { Importe } from '@/ui/sistema/Importe'

const MEDIOS: { valor: MedioCaja; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'qr', texto: 'QR' },
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
    const montoCentavos = pesosACentavos(Number(monto) || 0)
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
    <div className="mt-2 rounded-2xl px-3.5 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[12px] font-semibold">Movimientos manuales</h3>
          <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--tenue)' }}>Solo los de efectivo impactan el cierre.</p>
        </div>
        <Boton variante="secundario" className="!px-2.5 !py-2 !text-[11px]" onClick={() => setAbierto((actual) => !actual)}>
          {abierto ? 'Cerrar' : 'Agregar'}
        </Boton>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl px-2.5 py-2" style={{ background: 'var(--chip-fondo)' }}>
          <span style={{ color: 'var(--tenue)' }}>Entradas</span><div className="mt-0.5 font-semibold" style={{ color: 'var(--verde)' }}>{formatearPesos(entradas)}</div>
        </div>
        <div className="rounded-xl px-2.5 py-2" style={{ background: 'var(--chip-fondo)' }}>
          <span style={{ color: 'var(--tenue)' }}>Salidas</span><div className="mt-0.5 font-semibold" style={{ color: 'var(--ambar)' }}>{formatearPesos(salidas)}</div>
        </div>
      </div>

      {abierto && (
        <form className="form-shell form-card movement-form mt-3" onSubmit={(evento) => void guardar(evento)}>
          <div className="form-section-heading">
            <span className="form-intro-icon" aria-hidden="true"><IconoMovimiento /></span>
            <div><h3>Registrar movimiento</h3><p>Anotá entradas o salidas que no vienen de una venta.</p></div>
          </div>
          <div className="form-field-row">
            <label className="form-field">
              <span className="form-field-label">Tipo</span>
              <select aria-label="Tipo de movimiento" className="form-input" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoMovimientoCaja)}>
                <option value="salida">Salida</option><option value="entrada">Entrada</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-field-label">Medio</span>
              <select aria-label="Medio del movimiento" className="form-input" value={medioPago} onChange={(evento) => setMedioPago(evento.target.value as MedioCaja)}>
                {MEDIOS.map((medio) => <option key={medio.valor} value={medio.valor}>{medio.texto}</option>)}
              </select>
            </label>
          </div>
          <p className="form-callout movement-impact" data-kind={tipo}>
            {tipo === 'entrada' ? 'Esta entrada va a sumar al saldo de caja.' : 'Esta salida va a descontarse del saldo de caja.'}
          </p>
          <label className="form-field">
            <span className="form-field-label">Concepto <em>obligatorio</em></span>
            <input aria-label="Concepto del movimiento" placeholder="Ej. Pago a proveedor" className="form-input" list="conceptos-caja" value={concepto} onChange={(evento) => setConcepto(evento.target.value)} />
            <datalist id="conceptos-caja">{SUGERENCIAS.map((sugerencia) => <option key={sugerencia} value={sugerencia} />)}</datalist>
            <span className="form-field-help">Elegí una sugerencia o escribí una referencia para reconocerlo después.</span>
          </label>
          <label className="form-field">
            <span className="form-field-label">Monto <em>importe en pesos</em></span>
            <div className="form-input-with-prefix"><span aria-hidden="true">$</span><input aria-label="Monto del movimiento" inputMode="decimal" placeholder="Ej. 15.000" className="form-input form-input-large tabular" value={monto} onChange={(evento) => setMonto(evento.target.value)} /></div>
          </label>
          <Boton variante="principal" type="submit" className="w-full !py-2.5 !text-[12px]">Guardar movimiento</Boton>
          {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
        </form>
      )}

      {(movimientos ?? []).length > 0 && (
        <ul className="mt-3">
          {(movimientos ?? []).slice(0, 8).map((movimiento) => (
            <li key={movimiento.id} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid var(--linea)' }}>
              <span className="flex-1 min-w-0"><span className="block truncate text-[11.5px]">{movimiento.concepto}</span><span className="text-[10px]" style={{ color: 'var(--tenue)' }}>{new Date(movimiento.fecha).toLocaleDateString('es-AR')} · {movimiento.medioPago}</span></span>
              <Importe centavos={movimiento.tipo === 'salida' ? -movimiento.monto : movimiento.monto} tamaño="chico" style={{ color: movimiento.tipo === 'salida' ? 'var(--ambar)' : 'var(--verde)' }} />
              <button type="button" aria-label={`Eliminar movimiento ${movimiento.concepto}`} className="icon-action-button" style={{ color: 'var(--tenue)' }} onClick={() => void eliminar(movimiento.id)}><IconoCerrar /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
