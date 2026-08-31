'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ItemVenta, MedioPago } from '@/dominio/tipos'
import { agregarProducto, cambiarCantidad, totalTicket } from '@/dominio/ticket'
import { repos } from '@/datos/local/repos'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'
import { Cabecera } from './Cabecera'
import { Ticket } from './Ticket'
import { Cobro } from './Cobro'
import { BotonEscanear } from './BotonEscanear'
import { CatalogoVender } from './CatalogoVender'

export function PantallaVender() {
  const [items, setItems] = useState<ItemVenta[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])

  const total = totalTicket(items)

  async function cobrar(medio: MedioPago) {
    if (items.length === 0) return
    await repos.ventas.registrar({ items, medioPago: medio, clienteId: null })
    setItems([])
    setCobrando(false)
  }

  return (
    <div>
      <Cabecera />

      <div className="mt-4" style={{ borderTop: '1px solid var(--linea)' }}>
        <div className="flex items-baseline justify-between px-5 pt-3.5 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
            Venta en curso
          </span>
          <span className="text-[11px]" style={{ color: 'var(--tenue)' }}>
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <Ticket
          items={items}
          onCambiarCantidad={(productoId, cantidad) =>
            setItems((actuales) => cambiarCantidad(actuales, productoId, cantidad))
          }
        />
      </div>

      <div
        className="mx-5 mt-3 flex items-baseline justify-between pt-3.5"
        style={{ borderTop: '1.5px solid var(--tinta)' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
        <Importe centavos={total} tamaño="grande" className="!text-3xl" />
      </div>

      <div className="px-5 pt-4">
        <Boton
          variante="principal"
          className="w-full"
          disabled={items.length === 0}
          onClick={() => setCobrando(true)}
        >
          Cobrar
        </Boton>
      </div>

      {cobrando && <Cobro total={total} onCobrar={cobrar} />}

      <div className="px-5 pt-3">
        <BotonEscanear
          onProducto={(producto) => setItems((actuales) => agregarProducto(actuales, producto))}
        />
      </div>

      <CatalogoVender
        productos={productos}
        busqueda={busqueda}
        onBuscar={setBusqueda}
        onElegir={(producto) => setItems((actuales) => agregarProducto(actuales, producto))}
      />
    </div>
  )
}
