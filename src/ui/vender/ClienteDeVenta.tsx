'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { formatearPesos } from '@/dominio/dinero'
import { estadoFidelidad, textoPremio, type ConfigFidelidad } from '@/dominio/fidelidad'
import type { UUID } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/validaciones'
import type { Descuento } from '@/dominio/ventaAbierta'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Hoja } from '@/ui/sistema/Hoja'

/** A quién se le vende (opcional): suma sellos de "la décima gratis" y deja
 *  la compra en su historial. Si tiene un premio, se usa con un toque. */
export function ClienteDeVenta({
  clienteId, canje, fidelidad, onElegir, onCanje,
}: {
  clienteId?: UUID
  canje: boolean
  fidelidad?: ConfigFidelidad
  onElegir: (id: UUID | undefined) => void
  onCanje: (premio: Descuento | null) => void
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const datos = useLiveQuery(async () => {
    const clientes = await repos.clientes.todos()
    const ventas = clienteId && fidelidad?.activa ? (await repos.ventas.todas()).filter((venta) => venta.clienteId === clienteId) : []
    return { clientes, ventas }
  }, [clienteId, fidelidad?.activa], { clientes: [], ventas: [] })
  const cliente = datos.clientes.find((item) => item.id === clienteId)
  const estado = cliente && fidelidad?.activa ? estadoFidelidad(datos.ventas, cliente.id, fidelidad) : null
  if (datos.clientes.length === 0) return null

  const aguja = normalizarTexto(busqueda)
  const visibles = datos.clientes
    .filter((item) => !aguja || normalizarTexto(`${item.nombre} ${item.telefono ?? ''}`).includes(aguja))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 30)

  return (
    <div className="f-venta-cliente">
      {cliente ? (
        <>
          <div className="f-venta-cliente-fila">
            <span className="f-venta-cliente-nombre">
              <strong>{cliente.nombre}</strong>
              {estado && (
                <span className="f-venta-sellos" aria-label={`${estado.sellos} de ${estado.cadaCompras} sellos`}>
                  {Array.from({ length: Math.min(estado.cadaCompras, 12) }, (_, i) => <i key={i} data-lleno={i < estado.sellos ? 'true' : undefined} />)}
                  {estado.cadaCompras > 12 && <em>{estado.sellos}/{estado.cadaCompras}</em>}
                </span>
              )}
            </span>
            <button type="button" className="f-venta-cliente-quitar" onClick={() => onElegir(undefined)} aria-label={`Quitar a ${cliente.nombre} de la venta`}>Quitar</button>
          </div>
          {estado && fidelidad && (estado.premios > 0 ? (
            <label className="f-venta-premio" data-activo={canje ? 'true' : undefined}>
              <input type="checkbox" checked={canje} onChange={(evento) => onCanje(evento.target.checked ? fidelidad.premio : null)} />
              <span>Usar premio: {textoPremio(fidelidad.premio, formatearPesos)}</span>
            </label>
          ) : (
            <span className="f-dato">Le {estado.faltan === 1 ? 'falta 1 compra' : `faltan ${estado.faltan} compras`} para el premio{fidelidad.minimo > 0 ? ` (desde ${formatearPesos(fidelidad.minimo)})` : ''}.</span>
          ))}
        </>
      ) : (
        <button type="button" className="f-venta-cliente-agregar" onClick={() => { setBusqueda(''); setEligiendo(true) }}>
          + Cliente {fidelidad?.activa ? '(suma sellos)' : '(opcional)'}
        </button>
      )}
      {eligiendo && createPortal(
      <Hoja abierta onCerrar={() => setEligiendo(false)} titulo="¿A quién le vendés?" ancho="angosto">
        <div className="f-venta-cliente-buscar"><CampoBusqueda etiqueta="Buscar cliente para la venta" placeholder="Nombre o teléfono" valor={busqueda} onCambiar={setBusqueda} /></div>
        <ul className="f-venta-cliente-lista">
          {visibles.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => { onElegir(item.id); setEligiendo(false) }}>
                <strong>{item.nombre}</strong>
                {item.telefono && <span>{item.telefono}</span>}
              </button>
            </li>
          ))}
        </ul>
      </Hoja>,
      document.body,
      )}
    </div>
  )
}
