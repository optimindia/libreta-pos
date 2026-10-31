'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { Hoja } from '@/ui/sistema/Hoja'
import { Boton } from '@/ui/sistema/Boton'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { IconoEditar, IconoEliminar } from '@/ui/sistema/iconos'

/** Las categorías del catálogo: cambiarles el nombre (si coincide con otra,
 *  se juntan) o quitarlas (los productos quedan sin categoría, no se
 *  borran). Las nuevas se crean al cargar un producto. */
export function HojaCategorias({ onCerrar }: { onCerrar: () => void }) {
  const categorias = useLiveQuery(() => repos.productos.categorias(), [], [])
  const [editando, setEditando] = useState<{ nombre: string; texto: string } | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function renombrar() {
    if (!editando) return
    const nuevo = editando.texto.trim()
    if (nuevo === '' || nuevo === editando.nombre) { setEditando(null); return }
    const juntas = categorias.some((categoria) => categoria.nombre === nuevo)
    const cantidad = await repos.productos.renombrarCategoria(editando.nombre, nuevo)
    setAviso(juntas ? `Juntaste ${editando.nombre} con ${nuevo}.` : `${editando.nombre} ahora se llama ${nuevo} (${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}).`)
    setEditando(null)
  }

  async function quitar(nombre: string) {
    const cantidad = await repos.productos.renombrarCategoria(nombre, '')
    setAviso(`Quitaste ${nombre}. ${cantidad} ${cantidad === 1 ? 'producto quedó' : 'productos quedaron'} sin categoría.`)
    setQuitando(null)
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Categorías" ancho="angosto">
      <div className="f-categorias">
        <p className="f-hoja-ayuda">Cambiá el nombre o quitá una categoría. Los productos no se borran. Para crear una nueva, elegí “+ Nueva” al cargar un producto.</p>
        {aviso && <p className="f-aviso" data-tono="ok" role="status">{aviso}</p>}
        {categorias.length === 0 ? (
          <EstadoVacio compacto titulo="Todavía no hay categorías" texto="Se crean al cargar un producto y elegir una." />
        ) : (
          <ul className="f-categorias-lista">
            {categorias.map((categoria) => (
              <li key={categoria.nombre}>
                {editando?.nombre === categoria.nombre ? (
                  <form className="f-categorias-editar" onSubmit={(evento) => { evento.preventDefault(); void renombrar() }}>
                    <input
                      aria-label={`Nuevo nombre para ${categoria.nombre}`}
                      className="f-entrada"
                      autoFocus
                      value={editando.texto}
                      onChange={(evento) => setEditando({ nombre: categoria.nombre, texto: evento.target.value })}
                      onKeyDown={(evento) => { if (evento.key === 'Escape') { evento.stopPropagation(); setEditando(null) } }}
                    />
                    <Boton type="submit" variante="principal" tamano="chico">Listo</Boton>
                  </form>
                ) : quitando === categoria.nombre ? (
                  <div className="f-categorias-confirmar" role="group" aria-label={`¿Quitar ${categoria.nombre}?`}>
                    <span>¿Quitar <b>{categoria.nombre}</b>? {categoria.cantidad} {categoria.cantidad === 1 ? 'producto queda' : 'productos quedan'} sin categoría.</span>
                    <span className="f-categorias-botones">
                      <Boton variante="cuidado" tamano="chico" onClick={() => void quitar(categoria.nombre)}>Sí, quitar</Boton>
                      <Boton variante="secundario" tamano="chico" onClick={() => setQuitando(null)}>No</Boton>
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="f-categorias-nombre">
                      <b>{categoria.nombre}</b>
                      <small>{categoria.cantidad} {categoria.cantidad === 1 ? 'producto' : 'productos'}</small>
                    </span>
                    <button type="button" className="f-icono-boton f-stock-accion" aria-label={`Cambiar el nombre de ${categoria.nombre}`} title="Cambiar el nombre" onClick={() => { setAviso(null); setEditando({ nombre: categoria.nombre, texto: categoria.nombre }) }}>
                      <IconoEditar />
                    </button>
                    <button type="button" className="f-icono-boton f-stock-accion" aria-label={`Quitar ${categoria.nombre}`} title="Quitar la categoría" onClick={() => { setAviso(null); setQuitando(categoria.nombre) }}>
                      <IconoEliminar />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  )
}
