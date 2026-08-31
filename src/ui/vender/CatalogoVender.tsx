'use client'

import type { Producto } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

/** Quita acentos y pasa a minúscula, igual que repos.productos.buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** El catálogo para vender: cada producto es una tarjeta con su precio a
 *  la vista (antes había que recordarlo), y un buscador que aparece recién
 *  cuando el catálogo crece lo suficiente para necesitarlo. */
export function CatalogoVender({
  productos,
  busqueda,
  onBuscar,
  onElegir,
}: {
  productos: Producto[]
  busqueda: string
  onBuscar: (texto: string) => void
  onElegir: (producto: Producto) => void
}) {
  const aguja = normalizar(busqueda)
  const visibles = aguja === ''
    ? productos
    : productos.filter((producto) => normalizar(producto.nombre).includes(aguja))

  return (
    <section className="mt-6 px-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
          Productos
        </h2>
        {productos.length > 6 && (
          <span className="text-[11px]" style={{ color: 'var(--tenue)' }}>{productos.length}</span>
        )}
      </div>

      {productos.length > 6 && (
        <input
          aria-label="Buscar producto"
          placeholder="Buscar…"
          className="mt-2 w-full rounded-xl px-3 py-2 text-[13px]"
          style={campo}
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
        />
      )}

      {visibles.length === 0 ? (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--tenue)' }}>
          Ningún producto coincide con &ldquo;{busqueda}&rdquo;.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {visibles.map((producto) => (
            <button
              key={producto.id}
              className="rounded-2xl px-3.5 py-3 text-left active:opacity-70"
              style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', boxShadow: 'var(--sombra)' }}
              onClick={() => onElegir(producto)}
            >
              <div className="truncate text-[13px] font-medium">{producto.nombre}</div>
              <Importe centavos={producto.precio} tamaño="chico" className="mt-1" style={{ color: 'var(--verde)' }} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}