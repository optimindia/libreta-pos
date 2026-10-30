'use client'

import { useState, type ReactNode } from 'react'
import type { Producto } from '@/dominio/tipos'
import { formatearPesos } from '@/dominio/dinero'
import { repos } from '@/datos/local/repos'
import { precioVigente, tieneOfertaVigente } from '@/dominio/ticket'
import { IconoFavorito, IconoFiltro, IconoGanancia, IconoStock } from '@/ui/sistema/iconos'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { TEXTOS } from '@/ui/sistema/textos'

/** Quita acentos y pasa a minúscula, igual que repos.productos.buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Cuánto stock queda como para avisarlo en la baldosa. */
const POCO_STOCK = 3

/** Filtro especial: los productos marcados con la estrella. */
const FAVORITOS = '\u0000favoritos'

/** El catálogo para vender: un buscador grande, los filtros en chips y cada
 *  producto como una baldosa con el precio bien grande. Si ya está en la
 *  venta lleva borde tinta y el número de unidades; sin stock queda gris;
 *  sin precio, ámbar. */
export function CatalogoVender({
  productos,
  disponibles,
  cantidades,
  busqueda,
  onBuscar,
  onElegir,
  masVendidos = [],
  escaner,
  acciones,
  lectorListo = false,
  atajos = false,
}: {
  productos: Producto[]
  /** Lo que se puede vender de cada producto (stock menos reservas). */
  disponibles?: Record<string, number>
  /** Cuántas unidades de cada producto lleva el ticket (por id). */
  cantidades: Record<string, number>
  busqueda: string
  onBuscar: (texto: string) => void
  onElegir: (producto: Producto) => void
  /** Los que más salieron últimamente: accesos directos de un toque. */
  masVendidos?: Producto[]
  /** El botón de la cámara, que va al lado del buscador. */
  escaner?: ReactNode
  /** Otros botones al lado del buscador (monto libre). */
  acciones?: ReactNode
  /** En la PC avisa que el lector de código de barras está andando. */
  lectorListo?: boolean
  /** Muestra la tecla "/" en el buscador (atajos de PC prendidos). */
  atajos?: boolean
}) {
  const aguja = normalizar(busqueda)
  const categorias = [...new Set(productos.map((producto) => producto.categoria).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, 'es'))
  const hayFavoritos = productos.some((producto) => producto.favorito)
  const [categoria, setCategoria] = useState('')
  const deLaCategoria = (producto: Producto) =>
    categoria === '' || (categoria === FAVORITOS ? Boolean(producto.favorito) : producto.categoria === categoria)
  const visibles = productos.filter((producto) =>
    deLaCategoria(producto) &&
    (aguja === '' || normalizar(`${producto.nombre} ${producto.codigoBarras ?? ''} ${producto.categoria ?? ''}`).includes(aguja)),
  )
  const quedan = (producto: Producto) => disponibles?.[producto.id] ?? producto.stock

  return (
    <section className="f-catalogo" aria-label="Productos">
      <div className="f-catalogo-busqueda">
        <CampoBusqueda
          etiqueta="Buscar producto"
          placeholder="Buscá o escaneá"
          tamano="grande"
          className="f-catalogo-buscar"
          title={atajos ? 'Atajos: / buscar · Esc limpiar · Ctrl+Enter cobrar' : undefined}
          atajo={atajos ? '/' : undefined}
          valor={busqueda}
          onCambiar={onBuscar}
        />
        {escaner}
        {acciones}
      </div>

      {lectorListo && (
        <p className="f-lector f-solo-pc">
          <span className="f-lector-punto" aria-hidden="true" />
          <span><b>Lector listo:</b> pasá el producto y se suma solo.</span>
        </p>
      )}

      {masVendidos.length > 0 && categoria === '' && (
        <div className="f-catalogo-fila">
        <p className="f-catalogo-rotulo" aria-hidden="true"><IconoGanancia /> Lo que más sale · tocá para sumar</p>
        <Chips etiqueta="Más vendidos" className="f-mas-vendidos">
          {masVendidos.map((producto) => (
            <Chip key={producto.id} activo={false} onClick={() => onElegir(producto)} aria-label={`Sumar ${producto.nombre}, más vendido`}>
              {producto.nombre}
            </Chip>
          ))}
        </Chips>
        </div>
      )}

      {(categorias.length > 0 || hayFavoritos) && (
        <div className="f-catalogo-fila">
        <p className="f-catalogo-rotulo" aria-hidden="true"><IconoFiltro /> Categorías</p>
        <Chips etiqueta="Categorías">
          <Chip activo={categoria === ''} onClick={() => setCategoria('')}>Todo</Chip>
          {hayFavoritos && (
            <Chip activo={categoria === FAVORITOS} onClick={() => setCategoria(FAVORITOS)}>
              <IconoFavorito />Favoritos
            </Chip>
          )}
          {categorias.map((opcion) => (
            <Chip key={opcion} activo={categoria === opcion} onClick={() => setCategoria(opcion)}>{opcion}</Chip>
          ))}
        </Chips>
        </div>
      )}

      {visibles.length === 0 ? (
        productos.length === 0 ? (
          <EstadoVacio
            icono={<IconoStock />}
            titulo="Todavía no tenés productos"
            texto="Cargalos una vez y después vendés con dos toques."
            accion={{ etiqueta: TEXTOS.cargarProducto, href: '/stock' }}
          />
        ) : (
          <EstadoVacio compacto titulo="No encontramos ese producto" texto={busqueda.trim() ? `Ningún producto coincide con “${busqueda}”. Probá con otro nombre o código.` : 'No hay productos en esta categoría. Probá con otra.'} />
        )
      ) : (
        <div className="f-productos">
          {visibles.map((producto) => {
            const stock = quedan(producto)
            const sinStock = stock <= 0
            const enVenta = cantidades[producto.id] ?? 0
            const poco = !sinStock && stock <= POCO_STOCK
            const oferta = tieneOfertaVigente(producto)
            const sinPrecio = precioVigente(producto) <= 0
            const estado = sinStock ? 'sin-stock' : sinPrecio ? 'sin-precio' : 'normal'
            return (
              <div key={producto.id} className="f-producto-caja">
                <button
                  type="button"
                  className="f-producto"
                  data-estado={estado}
                  data-en-venta={enVenta > 0 ? 'true' : 'false'}
                  disabled={sinStock}
                  onClick={() => onElegir(producto)}
                >
                  <span className="f-producto-nombre">{producto.nombre}</span>
                  {sinPrecio && !sinStock ? (
                    <span className="f-producto-accion">Ponerle precio</span>
                  ) : (
                    <span className="f-producto-pie">
                      <span className="f-producto-precio f-plata">
                        {oferta && <s className="f-producto-viejo">{formatearPesos(producto.precio)}</s>}
                        {sinPrecio ? 'Sin precio' : formatearPesos(precioVigente(producto))}
                      </span>
                      {sinStock ? (
                        <Etiqueta tono="blanco">Sin stock</Etiqueta>
                      ) : (
                        <span className="f-producto-nota" data-poco={poco ? 'true' : 'false'}>
                          <IconoStock />{oferta ? `Oferta · quedan ${stock}` : `quedan ${stock}`}
                        </span>
                      )}
                    </span>
                  )}
                </button>
                {enVenta > 0 && <span className="f-producto-numero" aria-label={`${enVenta} en el ticket`}>{enVenta}</span>}
                <button
                  type="button"
                  className="f-producto-estrella"
                  data-activa={producto.favorito ? 'true' : 'false'}
                  aria-label={producto.favorito ? `Quitar ${producto.nombre} de favoritos` : `Agregar ${producto.nombre} a favoritos`}
                  title={producto.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
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
