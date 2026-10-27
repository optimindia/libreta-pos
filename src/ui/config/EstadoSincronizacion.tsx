'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { EVENTO_DATOS_PENDIENTES, MAX_INTENTOS, reintentarTodos } from '@/datos/local/cola'
import { Boton } from '@/ui/sistema/Boton'
import { IconoReintentar, IconoSincronizado } from '@/ui/sistema/iconos'

const NOMBRES: Record<string, string> = { venta: 'ventas', producto: 'productos', movimientoStock: 'movimientos de stock', fiado: 'fiados', fiadoPago: 'pagos', ingreso: 'ingresos', cliente: 'clientes', cierre: 'cierres', movimientoCaja: 'movimientos de caja', pedido: 'pedidos', preferencias: 'preferencias' }

export function EstadoSincronizacion() {
  const [reintentando, setReintentando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const cola = useLiveQuery(() => db.cola.orderBy('creadoEn').reverse().toArray(), [], [])
  const agotados = cola.filter((item) => item.intentos >= MAX_INTENTOS)
  const cantidadPorEntidad = [...new Set(cola.map((item) => NOMBRES[item.entidad] ?? item.entidad))].join(', ')
  const ultimoError = agotados[0]?.ultimoError

  async function reintentar() {
    setReintentando(true)
    const cantidad = await reintentarTodos()
    setAviso(cantidad > 0 ? `Se reactivaron ${cantidad} operaciones.` : 'No había operaciones pausadas.')
    setReintentando(false)
  }

  function sincronizarAhora() {
    window.dispatchEvent(new Event(EVENTO_DATOS_PENDIENTES))
    setAviso('Buscando cambios y enviando lo pendiente…')
  }

  return (
    <section className="sync-health-card" aria-labelledby="sync-health-title">
      <div className="sync-health-header"><div><span className="sync-health-kicker">Respaldo en la nube</span><h2 id="sync-health-title">{cola.length === 0 ? 'Todo sincronizado' : 'Hay cambios por sincronizar'}</h2><p>{cola.length === 0 ? 'Tus datos ya están guardados en tus otros dispositivos.' : `${cola.length} operaciones guardadas · ${cantidadPorEntidad}.`}</p></div><span className="sync-status-icon" style={{ color: agotados.length > 0 ? 'var(--ambar)' : 'var(--verde)' }}>{cola.length === 0 ? <IconoSincronizado /> : <IconoReintentar />}</span></div>
      <div className="sync-health-actions"><Boton variante="secundario" type="button" onClick={sincronizarAhora}>Sincronizar ahora</Boton>{agotados.length > 0 && <Boton variante="principal" type="button" disabled={reintentando} onClick={() => void reintentar()}>{reintentando ? 'Reintentando…' : 'Reintentar operaciones'}</Boton>}</div>
      {agotados.length > 0 && <p className="sync-health-error" role="alert">{agotados.length} operaciones no pudieron enviarse. {ultimoError ? `Motivo: ${ultimoError}` : 'Reintentá cuando vuelva la conexión.'}</p>}
      {aviso && <p role="status" className="sync-health-message">{aviso}</p>}
    </section>
  )
}
