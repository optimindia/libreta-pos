'use client'

import './saldo.css'
import { useEffect, useState } from 'react'
import { formatearCantidad } from '@/dominio/cantidad'
import { formatearPesos } from '@/dominio/dinero'
import { leerCuentaCompartida, type CuentaCompartida } from '@/datos/nube/cuentaCliente'

type Estado = { tipo: 'cargando' } | { tipo: 'sin-link' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; cuenta: CuentaCompartida }

const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function fecha(iso: string): string {
  const valor = new Date(iso)
  return Number.isNaN(valor.getTime()) ? '' : FECHA.format(valor).replace('.', '')
}

/** Lo que ve el cliente con el link que le mandó el almacén: cuánto debe y
 *  sus últimos fiados y pagos. Sólo lectura; el token va después del #, así
 *  no queda en ningún registro del servidor. */
export function PantallaSaldo() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, '').trim().toLowerCase()
    let vivo = true
    if (!/^[0-9a-f]{48,128}$/.test(token)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el token sólo existe en el navegador
      setEstado({ tipo: 'sin-link' })
      return
    }
    leerCuentaCompartida(token)
      .then((cuenta) => { if (vivo) setEstado(cuenta ? { tipo: 'listo', cuenta } : { tipo: 'sin-link' }) })
      .catch((error: unknown) => { if (vivo) setEstado({ tipo: 'error', mensaje: error instanceof Error ? error.message : 'No se pudo cargar la cuenta.' }) })
    return () => { vivo = false }
  }, [])

  if (estado.tipo === 'cargando') return <div className="f-saldo"><p className="f-saldo-aviso" role="status">Cargando tu cuenta…</p></div>
  if (estado.tipo === 'sin-link') {
    return (
      <div className="f-saldo">
        <h1>Este link ya no funciona</h1>
        <p className="f-saldo-aviso">Puede que el almacén haya dejado de compartirlo. Pedile uno nuevo.</p>
      </div>
    )
  }
  if (estado.tipo === 'error') return <div className="f-saldo"><h1>No pudimos abrir tu cuenta</h1><p className="f-saldo-aviso" role="alert">{estado.mensaje}</p></div>

  const { cuenta } = estado
  const movimientos = [
    ...cuenta.fiados.map((fiado) => ({ tipo: 'fiado' as const, fecha: fiado.fecha, monto: fiado.monto, detalle: fiado.items.map((item) => `${formatearCantidad(item.cantidad)} ${item.nombre}`).join(', ') })),
    ...cuenta.pagos.map((pago) => ({ tipo: 'pago' as const, fecha: pago.fecha, monto: pago.monto, detalle: '' })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 40)

  return (
    <div className="f-saldo">
      <p className="f-saldo-negocio">{cuenta.negocio}</p>
      <h1>Hola, {cuenta.cliente.split(' ')[0]}</h1>
      <section className="f-saldo-total" data-al-dia={cuenta.saldo <= 0 ? 'true' : undefined} aria-label="Tu saldo">
        <span>{cuenta.saldo > 0 ? 'Debés' : 'Estás al día'}</span>
        {cuenta.saldo > 0 && <strong>{formatearPesos(cuenta.saldo)}</strong>}
      </section>
      <h2>Últimos movimientos</h2>
      {movimientos.length === 0 ? <p className="f-saldo-aviso">Todavía no hay movimientos.</p> : (
        <ul className="f-saldo-lista">
          {movimientos.map((movimiento, i) => (
            <li key={`${movimiento.fecha}-${i}`} data-tipo={movimiento.tipo}>
              <span className="f-saldo-fecha">{fecha(movimiento.fecha)}</span>
              <span className="f-saldo-detalle">
                <strong>{movimiento.tipo === 'fiado' ? 'Compra fiada' : 'Pago'}</strong>
                {movimiento.detalle && <span>{movimiento.detalle}</span>}
              </span>
              <span className="f-saldo-monto">{movimiento.tipo === 'pago' ? '−' : '+'}{formatearPesos(movimiento.monto)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="f-saldo-pie">Esta página es sólo para mirar. Ante cualquier duda, hablá con {cuenta.negocio}. Hecho con Libreta.</p>
    </div>
  )
}
