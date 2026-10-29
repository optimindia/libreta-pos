'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { EVENTO_DATOS_PENDIENTES, MAX_INTENTOS, reintentarTodos } from '@/datos/local/cola'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { TEXTOS } from '@/ui/sistema/textos'

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
    setAviso(cantidad > 0 ? `Se volvieron a activar ${cantidad} cambios.` : 'No había cambios pausados.')
    setReintentando(false)
  }

  function sincronizarAhora() {
    window.dispatchEvent(new Event(EVENTO_DATOS_PENDIENTES))
    setAviso('Buscando cambios y enviando lo que falta…')
  }

  return (
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="sync-health-title">
      <div className="f-config-cabeza">
        <div>
          <h2 id="sync-health-title" className="f-seccion">{cola.length === 0 ? TEXTOS.alDia : TEXTOS.cambiosSinEnviar}</h2>
          <p className="f-dato">{cola.length === 0 ? 'Lo que cargaste ya está en tus otros dispositivos.' : `${cola.length} ${cola.length === 1 ? 'cambio guardado' : 'cambios guardados'} · ${cantidadPorEntidad}.`}</p>
        </div>
        <Etiqueta tono={agotados.length > 0 ? 'ambar' : cola.length === 0 ? 'verde' : 'gris'} punto>
          {cola.length === 0 ? 'Al día' : agotados.length > 0 ? 'Con errores' : 'Pendiente'}
        </Etiqueta>
      </div>
      <div className="f-config-botones">
        <Boton variante="secundario" type="button" onClick={sincronizarAhora}>Actualizar ahora</Boton>
        {agotados.length > 0 && <Boton variante="secundario" type="button" disabled={reintentando} onClick={() => void reintentar()}>{reintentando ? 'Reintentando…' : 'Reintentar envío'}</Boton>}
      </div>
      {agotados.length > 0 && <p className="f-aviso" data-tono="ambar" role="alert">{agotados.length} {agotados.length === 1 ? 'cambio no pudo enviarse' : 'cambios no pudieron enviarse'}. {ultimoError ? `Motivo: ${ultimoError}` : 'Reintentá cuando vuelva la conexión.'}</p>}
      {aviso && <p role="status" className="f-dato">{aviso}</p>}
    </Tarjeta>
  )
}
