'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { faltantes } from '@/dominio/stock'
import { Boton } from '@/ui/sistema/Boton'
import { FormularioProducto } from './FormularioProducto'
import { SubirFactura } from './SubirFactura'
import { ActualizarPrecios } from './ActualizarPrecios'
import { CatalogoStock } from './CatalogoStock'

type Pestaña = 'catalogo' | 'cargar' | 'precios'

export function PantallaStock() {
  const [pestaña, setPestaña] = useState<Pestaña>('catalogo')
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

      <div className="flex gap-2">
        <Boton
          variante={pestaña === 'catalogo' ? 'principal' : 'secundario'}
          className="flex-1 !py-2 !text-[12px]"
          onClick={() => setPestaña('catalogo')}
        >
          Catálogo ({productos.length})
        </Boton>
        <Boton
          variante={pestaña === 'cargar' ? 'principal' : 'secundario'}
          className="flex-1 !py-2 !text-[12px]"
          onClick={() => setPestaña('cargar')}
        >
          Cargar
        </Boton>
        <Boton
          variante={pestaña === 'precios' ? 'principal' : 'secundario'}
          className="flex-1 !py-2 !text-[12px]"
          onClick={() => setPestaña('precios')}
        >
          Precios
        </Boton>
      </div>

      {pestaña === 'catalogo' && <CatalogoStock productos={productos} />}

      {pestaña === 'cargar' && (
        <div className="mt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
            Cargar producto
          </h2>
          <div className="mt-3">
            <FormularioProducto onGuardado={() => setPestaña('catalogo')} />
          </div>

          <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
            Cargar desde una factura
          </h2>
          <div className="mt-2">
            <SubirFactura />
          </div>
        </div>
      )}

      {pestaña === 'precios' && (
        <div className="mt-4">
          <ActualizarPrecios />
        </div>
      )}
    </div>
  )
}