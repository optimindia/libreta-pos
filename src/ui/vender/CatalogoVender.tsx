'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { Importe } from '@/ui/sistema/Importe'
import { repos } from '@/datos/local/repos'
import { precioVigente, tieneOfertaVigente } from '@/dominio/ticket'
import { IconoBuscar, IconoFavorito, IconoFlechaDerecha, IconoNuevaVenta, IconoStock } from '@/ui/sistema/iconos'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

/** Quita acentos y pasa a minúscula, igual que repos.productos.buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** El catálogo para vender: cada producto es una tarjeta con su precio a la
 *  vista y búsqueda por nombre o código desde el primer producto. */
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
  const categorias = [...new Set(productos.map((producto) => producto.categoria).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, 'es'))
  const [categoria, setCategoria] = useState('')
  const visibles = aguja === ''
    ? productos.filter((producto) => categoria === '' || producto.categoria === categoria)
    : productos.filter((producto) => normalizar(`${producto.nombre} ${producto.codigoBarras ?? ''} ${producto.categoria ?? ''}`).includes(aguja) && (categoria === '' || producto.categoria === categoria))
  const favoritos = productos.filter((producto) => producto.favorito && (categoria === '' || producto.categoria === categoria))

  return (
    <section className="catalogo-venta mt-6 px-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
          Productos
        </h2>
        <span className="text-[12px]" style={{ color: 'var(--tenue)' }}>{productos.length}</span>
      </div>

      <div className="catalog-search-wrap mt-2">
        <IconoBuscar />
        <input
          aria-label="Buscar producto"
          placeholder="Buscar por nombre o código…"
          className="catalogo-search w-full rounded-xl px-3 py-2.5 text-[13px]"
          style={campo}
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
        />
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>Atajos: / buscar · Esc limpiar · Ctrl+Enter cobrar</p>

      {categorias.length > 0 && <div className="catalogo-categories mt-2 flex gap-1.5 overflow-x-auto pb-0.5"><button type="button" className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: categoria === '' ? 'var(--verde)' : 'var(--hueso-2)', color: categoria === '' ? 'var(--verde-texto)' : 'var(--tinta)', border: '1px solid var(--linea)' }} onClick={() => setCategoria('')}>Todo</button>{categorias.map((opcion) => <button type="button" key={opcion} className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: categoria === opcion ? 'var(--verde)' : 'var(--hueso-2)', color: categoria === opcion ? 'var(--verde-texto)' : 'var(--tinta)', border: '1px solid var(--linea)' }} onClick={() => setCategoria(opcion)}>{opcion}</button>)}</div>}

      {busqueda.trim() === '' && favoritos.length > 0 && <div className="catalogo-favoritos mt-4"><div className="flex items-baseline justify-between"><h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Favoritos rápidos</h3><span className="text-[12px]" style={{ color: 'var(--tenue)' }}>{favoritos.length}</span></div><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{favoritos.map((producto) => <button type="button" key={producto.id} className="favorito-card min-w-28 rounded-xl px-2.5 py-2 text-left" style={{ background: 'var(--chip-fondo)', border: '1px solid var(--linea)' }} onClick={() => onElegir(producto)}><div className="truncate text-[12px] font-medium">{producto.nombre}</div><Importe centavos={producto.precio} tamaño="chico" className="mt-0.5" /></button>)}</div></div>}

      {visibles.length === 0 ? (
        <div className="catalog-empty mt-5 text-center">
          <span className="catalog-empty-icon" aria-hidden="true">
            <IconoStock />
          </span>
          <strong className="mt-3 block text-[14px]">{productos.length === 0 ? 'Tu catálogo te espera' : 'No encontramos ese producto'}</strong>
          <p className="mx-auto mt-1 max-w-xs text-[12px]" style={{ color: 'var(--tenue)' }}>
            {productos.length === 0 ? 'Cargá tus productos una vez y después vendé con dos toques.' : `Ningún producto coincide con “${busqueda}”.`}
          </p>
          {productos.length === 0 && <Link href="/stock" className="button-with-icon catalog-empty-action mt-4 inline-flex items-center rounded-xl px-3.5 py-2.5 text-[12px] font-semibold">Cargar productos <IconoFlechaDerecha /></Link>}
        </div>
      ) : (
        <div className="catalogo-grid mt-3 grid grid-cols-2 gap-2">
          {visibles.map((producto) => (
            <div
              key={producto.id}
              className="catalogo-producto rounded-2xl px-3.5 py-3"
              style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', boxShadow: 'var(--sombra)' }}
            >
              <div className="flex items-start gap-1"><button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-medium active:opacity-70" onClick={() => onElegir(producto)}>{producto.nombre}</button><button type="button" aria-label={producto.favorito ? 'Quitar favorito' : 'Agregar favorito'} title={producto.nombre} className="product-favorite-button" data-active={producto.favorito ? 'true' : 'false'} onClick={() => void repos.productos.marcarFavorito(producto.id, !producto.favorito)}><IconoFavorito /></button></div>
              <button type="button" disabled={producto.stock <= 0} className="catalogo-producto-action mt-1 w-full text-left active:opacity-70 disabled:cursor-not-allowed disabled:opacity-55" onClick={() => onElegir(producto)}>
                <span className="catalogo-producto-price-row">
                  <span className="catalogo-producto-prices">
                    {tieneOfertaVigente(producto) && <span className="catalogo-producto-old-price"><Importe centavos={producto.precio} tamaño="chico" /></span>}
                    <Importe centavos={precioVigente(producto)} tamaño="chico" style={{ color: producto.stock <= 0 ? 'var(--tenue)' : 'var(--verde)' }} />
                  </span>
                  <span className="catalogo-producto-add">{producto.stock <= 0 ? 'No disponible' : <><IconoNuevaVenta /> Agregar</>}</span>
                </span>
                <span className="mt-1 block text-[12px] font-semibold" style={{ color: producto.stock <= 0 ? 'var(--ambar)' : tieneOfertaVigente(producto) ? 'var(--verde)' : 'var(--tenue)' }}>{producto.stock <= 0 ? 'Sin stock · no vendible' : tieneOfertaVigente(producto) ? `Oferta activa · ${producto.stock} disponibles` : `${producto.stock} disponibles`}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
