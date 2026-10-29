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
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

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
    <Tarjeta como="section" className="fp-acciones fp-ancho" aria-labelledby="control-center-title">
      <div className="fp-acciones-cabeza">
        <div>
          <h2 id="control-center-title" className="f-seccion">Tu siguiente movimiento</h2>
          <p className="f-dato">{bajoControl ? 'No tenés nada urgente para resolver ahora.' : 'Priorizado para que sepas qué conviene hacer primero.'}</p>
        </div>
        <Etiqueta tono={bajoControl ? 'verde' : 'ambar'} punto>
          {bajoControl ? 'Bajo control' : `${visibles.length} ${visibles.length === 1 ? 'prioridad' : 'prioridades'}`}
        </Etiqueta>
      </div>

      {bajoControl ? (
        <div className="fp-acciones-ok">
          <span className="fp-icono" data-tono="verde" aria-hidden="true"><IconoNube /></span>
          <div>
            <strong className="f-renglon-texto">Todo tranquilo por acá</strong>
            <span className="f-dato">{pendientesSync > 0 ? `${pendientesSync} cambios esperan conexión para enviarse.` : 'Seguí vendiendo: la operación está ordenada.'}</span>
          </div>
        </div>
      ) : (
        <ul className="fp-acciones-lista">
          {visibles.map(({ id, titulo, detalle, href, severidad, Icono }) => (
            <li key={id}>
              <Link href={href} className="fp-accion">
                <span className="fp-icono" data-tono={severidad === 'critica' ? 'coral' : severidad === 'atencion' ? 'ambar' : 'verde'} aria-hidden="true"><Icono /></span>
                <span className="f-renglon-cuerpo">
                  <span className="f-renglon-titulo">{titulo}</span>
                  <span className="f-renglon-detalle">{detalle}</span>
                </span>
                <span className="fp-flecha" aria-hidden="true"><IconoFlechaDerecha /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}
