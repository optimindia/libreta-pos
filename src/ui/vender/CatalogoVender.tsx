'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import type { Producto } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { precioVigente, tieneOfertaVigente } from '@/dominio/ticket'
import { IconoBuscar, IconoFavorito, IconoFlechaDerecha, IconoStock } from '@/ui/sistema/iconos'

/** Quita acentos y pasa a minúscula, igual que repos.productos.buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Cuánto stock queda como para avisarlo en la baldosa. */
const POCO_STOCK = 3

/** El catálogo para vender: cada producto es una baldosa con el precio bien
 *  grande, un contador de cuántos hay en el ticket y un aviso si se acaba. */
export function CatalogoVender({
  productos,
  disponibles,
  cantidades,
  busqueda,
  onBuscar,
  onElegir,
  escaner,
}: {
  productos: Producto[]
  /** Lo que se puede vender de cada producto (stock menos reservas). */
  disponibles?: Record<string, number>
  /** Cuántas unidades de cada producto lleva el ticket (por id). */
  cantidades: Record<string, number>
  busqueda: string
  onBuscar: (texto: string) => void
  onElegir: (producto: Producto) => void
  /** El botón de la cámara, que va al lado del buscador. */
  escaner?: ReactNode
}) {
  const aguja = normalizar(busqueda)
  const categorias = [...new Set(productos.map((producto) => producto.categoria).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, 'es'))
  const [categoria, setCategoria] = useState('')
  const deLaCategoria = (producto: Producto) => categoria === '' || producto.categoria === categoria
  const visibles = productos.filter((producto) =>
    deLaCategoria(producto) &&
    (aguja === '' || normalizar(`${producto.nombre} ${producto.codigoBarras ?? ''} ${producto.categoria ?? ''}`).includes(aguja)),
  )
  const quedan = (producto: Producto) => disponibles?.[producto.id] ?? producto.stock
  const favoritos = productos.filter((producto) => producto.favorito && deLaCategoria(producto) && quedan(producto) > 0)

  return (
    <section className="mz-catalogo" aria-label="Productos">
      <div className="mz-buscar-fila">
        <label className="mz-buscador">
          <IconoBuscar />
          <input
            aria-label="Buscar producto"
            placeholder="Buscar o escanear"
            value={busqueda}
            onChange={(evento) => onBuscar(evento.target.value)}
          />
        </label>
        {escaner}
      </div>
      <p className="mz-atajos">Atajos: / buscar · Esc limpiar · Ctrl+Enter cobrar</p>

      {categorias.length > 0 && (
        <div className="mz-chips" role="group" aria-label="Categorías">
          <button type="button" className="mz-chip" aria-pressed={categoria === ''} onClick={() => setCategoria('')}>Todo</button>
          {categorias.map((opcion) => (
            <button key={opcion} type="button" className="mz-chip" aria-pressed={categoria === opcion} onClick={() => setCategoria(opcion)}>{opcion}</button>
          ))}
        </div>
      )}

      {busqueda.trim() === '' && favoritos.length > 0 && (
        <div className="mz-favoritos">
          <h2 className="mz-subtitulo">Favoritos</h2>
          <div className="mz-chips">
            {favoritos.map((producto) => (
              <button key={producto.id} type="button" className="mz-chip mz-chip-precio" onClick={() => onElegir(producto)}>
                {producto.nombre} <b className="tabular">{formatearPesos(precioVigente(producto))}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="mz-vacio-catalogo">
          <span aria-hidden="true"><IconoStock /></span>
          <strong>{productos.length === 0 ? 'Tu catálogo te espera' : 'No encontramos ese producto'}</strong>
          <p>{productos.length === 0 ? 'Cargá tus productos una vez y después vendé con dos toques.' : `Ningún producto coincide con “${busqueda}”.`}</p>
          {productos.length === 0 && <Link href="/stock" className="mz-boton-oscuro mz-toque">Cargar productos <IconoFlechaDerecha /></Link>}
        </div>
      ) : (
        <div className="mz-productos">
          {visibles.map((producto) => {
            const stock = quedan(producto)
            const sinStock = stock <= 0
            const enTicket = cantidades[producto.id] ?? 0
            const poco = !sinStock && stock <= POCO_STOCK
            const oferta = tieneOfertaVigente(producto)
            const sinPrecio = precioVigente(producto) <= 0
            return (
              <div key={producto.id} className="mz-producto-caja">
                <button
                  type="button"
                  className="mz-producto mz-toque"
                  data-en-ticket={enTicket > 0 ? 'true' : 'false'}
                  data-sin-precio={sinPrecio ? 'true' : 'false'}
                  disabled={sinStock}
                  onClick={() => onElegir(producto)}
                >
                  <span className="mz-producto-nombre">{producto.nombre}</span>
                  {sinPrecio ? (
                    <span className="mz-producto-precio mz-producto-sin-precio">Sin precio</span>
                  ) : (
                    <span className="mz-producto-precio tabular">
                      {oferta && <s className="mz-producto-viejo">{formatearPesos(producto.precio)}</s>}
                      {formatearPesos(precioVigente(producto))}
                    </span>
                  )}
                  <span className={`mz-producto-nota${sinStock || poco || sinPrecio ? ' is-poco' : ''}`}>
                    {sinStock
                      ? 'Sin stock'
                      : sinPrecio ? 'Tocá para ponerle precio'
                      : poco ? `Quedan ${stock}`
                      : oferta ? `Oferta · quedan ${stock}`
                      : `Quedan ${stock}`}
                  </span>
                </button>
                {enTicket > 0 && <span className="mz-contador" aria-label={`${enTicket} en el ticket`}>{enTicket}</span>}
                <button
                  type="button"
                  className="mz-estrella"
                  data-active={producto.favorito ? 'true' : 'false'}
                  aria-label={producto.favorito ? `Quitar ${producto.nombre} de favoritos` : `Agregar ${producto.nombre} a favoritos`}
                  onClick={() => void repos.productos.marcarFavorito(producto.id, !producto.favorito)}
                >
                  <IconoFavorito />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
