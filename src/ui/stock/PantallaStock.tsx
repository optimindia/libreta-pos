'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { faltantes } from '@/dominio/stock'
import { Importe } from '@/ui/sistema/Importe'
import { FormularioProducto } from './FormularioProducto'

export function PantallaStock() {
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  const faltan = faltantes(productos)

  return (
    <div className="px-5 pt-6">
      {faltan.length > 0 && (
        <div
          className="mb-5 rounded-xl px-3.5 py-3 text-[13px]"
          style={{ background: 'var(--ambar-fondo)', color: 'var(--ambar)', border: '1px solid var(--ambar)' }}
        >
          Te está faltando: {faltan.map((producto) => producto.nombre).join(', ')}.
        </div>
      )}

      <h1 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Cargar producto
      </h1>
      <div className="mt-3">
        <FormularioProducto />
      </div>

      <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Tu catálogo ({productos.length})
      </h2>
      <ul className="mt-2">
        {productos.map((producto) => (
          <li
            key={producto.id}
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '1px solid var(--linea)' }}
          >
            <div className="leading-tight">
              <div className="text-[13px] font-medium">{producto.nombre}</div>
              <div className="tabular text-[11px]" style={{ color: 'var(--tenue)' }}>
                quedan {producto.stock}
              </div>
            </div>
            <Importe centavos={producto.precio} tamaño="chico" />
          </li>
        ))}
      </ul>
    </div>
  )
}
