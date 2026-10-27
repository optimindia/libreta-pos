'use client'

import Link from 'next/link'
import {
  IconoEfectivo,
  IconoFiados,
  IconoFlechaDerecha,
  IconoNube,
  IconoPorcentaje,
  IconoStock,
} from '@/ui/sistema/iconos'

interface Props {
  agotados: number
  reposiciones: number
  vencidos: number
  alertasMargen: number
  cierrePendiente: boolean
  pendientesSync: number
}

interface Accion {
  id: string
  titulo: string
  detalle: string
  href: string
  severidad: 'critica' | 'atencion' | 'ok'
  Icono: () => React.JSX.Element
}

/** El panel convierte datos dispersos en una decisión concreta. Es el primer
 * lugar que mira el dueño: muestra sólo lo que requiere una acción hoy. */
export function CentroAcciones({
  agotados,
  reposiciones,
  vencidos,
  alertasMargen,
  cierrePendiente,
  pendientesSync,
}: Props) {
  const acciones: Accion[] = []
  if (agotados > 0) acciones.push({ id: 'agotados', titulo: `${agotados} ${agotados === 1 ? 'producto agotado' : 'productos agotados'}`, detalle: 'Evitá perder la próxima venta.', href: '/stock', severidad: 'critica', Icono: IconoStock })
  if (vencidos > 0) acciones.push({ id: 'vencidos', titulo: `${vencidos} ${vencidos === 1 ? 'cuenta vencida' : 'cuentas vencidas'}`, detalle: 'Mandá un recordatorio desde Fiados.', href: '/fiados', severidad: 'critica', Icono: IconoFiados })
  if (alertasMargen > 0) acciones.push({ id: 'margen', titulo: `${alertasMargen} ${alertasMargen === 1 ? 'precio para revisar' : 'precios para revisar'}`, detalle: 'Hay productos sin margen seguro.', href: '/stock', severidad: 'atencion', Icono: IconoPorcentaje })
  if (reposiciones > 0) acciones.push({ id: 'reponer', titulo: `Reponer ${reposiciones} ${reposiciones === 1 ? 'producto' : 'productos'}`, detalle: 'La lista ya está calculada.', href: '/plata#lista-compra', severidad: 'atencion', Icono: IconoStock })
  if (cierrePendiente) acciones.push({ id: 'cierre', titulo: 'Caja pendiente de cerrar', detalle: 'Contá el efectivo y detectá diferencias.', href: '/plata#caja', severidad: 'atencion', Icono: IconoEfectivo })

  const visibles = acciones.slice(0, 4)
  const bajoControl = visibles.length === 0

  return (
    <section className="control-center" aria-labelledby="control-center-title">
      <div className="control-center-heading">
        <div>
          <span className="page-kicker">Centro de control</span>
          <h2 id="control-center-title">Tu siguiente movimiento</h2>
          <p>{bajoControl ? 'No hay alertas operativas para resolver ahora.' : 'Priorizado para que sepas qué conviene hacer primero.'}</p>
        </div>
        <span className={`control-center-status${bajoControl ? ' is-ok' : ''}`}>
          <span className="control-center-status-dot" aria-hidden="true" />
          {bajoControl ? 'Bajo control' : `${visibles.length} ${visibles.length === 1 ? 'prioridad' : 'prioridades'}`}
        </span>
      </div>

      {bajoControl ? (
        <div className="control-center-clear">
          <span className="control-center-clear-icon" aria-hidden="true"><IconoNube /></span>
          <div><strong>Todo tranquilo por acá</strong><span>{pendientesSync > 0 ? `${pendientesSync} cambios esperan conexión para sincronizarse.` : 'Seguí vendiendo: la operación está ordenada.'}</span></div>
        </div>
      ) : (
        <div className="control-action-grid">
          {visibles.map(({ id, titulo, detalle, href, severidad, Icono }) => (
            <Link key={id} href={href} className="control-action-card" data-severity={severidad}>
              <span className="control-action-icon" aria-hidden="true"><Icono /></span>
              <span className="control-action-copy"><strong>{titulo}</strong><small>{detalle}</small></span>
              <IconoFlechaDerecha />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
