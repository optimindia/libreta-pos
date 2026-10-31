'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { faltantes } from '@/dominio/stock'
import { valorStock } from '@/dominio/reportes'
import { Boton } from '@/ui/sistema/Boton'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { FormularioProducto } from './FormularioProducto'
import { SubirFactura } from './SubirFactura'
import { ActualizarPrecios } from './ActualizarPrecios'
import { CatalogoStock } from './CatalogoStock'
import { HerramientasCatalogo } from './HerramientasCatalogo'
import { formatearPesos } from '@/dominio/dinero'
import { formatearCantidad, porUnidad, unidadDe } from '@/dominio/cantidad'
import type { Producto } from '@/dominio/tipos'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { usePuede } from '@/ui/sistema/usoRol'
import { Portada } from '@/ui/sistema/Portada'
import './stock.css'

type Pestaña = 'catalogo' | 'cargar' | 'precios'

export function PantallaStock() {
  const [pestaña, setPestaña] = useState<Pestaña>('catalogo')
  // Lo que se va cargando en esta tanda, el último arriba.
  const [tanda, setTanda] = useState<Producto[]>([])
  const productos = useLiveQuery(() => repos.productos.todos(), [], [])
  const { funciones } = useFuncionesNegocio()
  const importarCatalogo = funcionActiva(funciones, 'importarCatalogo')
  const escanerStock = funcionActiva(funciones, 'escanerStock')
  const importarFactura = funcionActiva(funciones, 'importarFactura')
  const faltan = faltantes(productos)
  // El vendedor mira el stock; cargar, editar y poner precios es del dueño
  // (la base se lo rechaza).
  const editaCatalogo = usePuede('editarProductos')
  const vista: Pestaña = editaCatalogo ? pestaña : 'catalogo'
  const inventario = valorStock(productos)
  const cuantos = `${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}`

  return (
    <div className="page-stock f-stock">
      <Portada
        id="stock"
        titulo="Stock"
        rotulo={editaCatalogo ? 'Mercadería que tenés, a costo' : 'Productos cargados'}
        valor={editaCatalogo ? inventario.costo : productos.length}
        formato={editaCatalogo ? 'pesos' : 'numero'}
        detalle={(
          <>
            <p>{cuantos}</p>
            {faltan.length > 0 && <p data-tenue="">{faltan.length} para reponer</p>}
          </>
        )}
        accion={editaCatalogo && vista === 'catalogo' && productos.length > 0
          ? <Boton variante="principal" className="f-stock-llego" onClick={() => setPestaña('cargar')}>+ Llegó mercadería</Boton>
          : undefined}
      />

      {vista === 'catalogo' && faltan.length > 0 && (
        <p className="f-aviso" data-tono="ambar">
          Te está faltando: {faltan.map((producto) => producto.nombre).join(', ')}.
        </p>
      )}

      {editaCatalogo && (
        <Chips etiqueta="Qué querés hacer" className="f-stock-pestanas">
          <Chip activo={pestaña === 'catalogo'} onClick={() => setPestaña('catalogo')}>Catálogo ({productos.length})</Chip>
          <Chip activo={pestaña === 'cargar'} onClick={() => setPestaña('cargar')}>Cargar</Chip>
          <Chip activo={pestaña === 'precios'} onClick={() => setPestaña('precios')}>Precios</Chip>
        </Chips>
      )}

      {vista === 'catalogo' && (
        <>
          <CatalogoStock productos={productos} onCargar={editaCatalogo ? () => setPestaña('cargar') : undefined} />
          {importarCatalogo && editaCatalogo && <HerramientasCatalogo productos={productos} />}
        </>
      )}

      {vista === 'cargar' && (
        <div className="f-stock-cargar">
          <div className="f-stock-cargar-cuerpo">
            <Tarjeta como="section" className="f-stock-ficha-nueva" aria-labelledby="stock-cargar-titulo">
              <div className="f-stock-ficha-cabeza">
                <h2 id="stock-cargar-titulo" className="f-seccion">Cargar productos</h2>
                <p className="f-stock-ayuda">Uno atrás del otro: guardá y la ficha queda lista para el próximo.</p>
              </div>
              <FormularioProducto
                escaner={escanerStock}
                onGuardado={(producto) => setTanda((actual) => [producto, ...actual])}
                onTerminar={() => { setTanda([]); setPestaña('catalogo') }}
              />
            </Tarjeta>
            <Tarjeta como="section" className="f-carga-tanda" aria-labelledby="stock-tanda-titulo">
              <h2 id="stock-tanda-titulo" className="f-seccion">Cargaste {tanda.length === 0 ? 'en esta tanda' : `${tanda.length} ${tanda.length === 1 ? 'producto' : 'productos'}`}</h2>
              {tanda.length === 0 ? (
                <p className="f-stock-ayuda">Lo que vayas guardando aparece acá, para que veas que entró bien.</p>
              ) : (
                <ul className="f-carga-lista">
                  {tanda.map((producto) => (
                    <li key={producto.id}>
                      <span className="f-carga-lista-nombre">{producto.nombre}</span>
                      <span className="f-carga-lista-detalle">
                        {formatearPesos(producto.precio)} {porUnidad(unidadDe(producto))} · {formatearCantidad(producto.stock, unidadDe(producto))}{unidadDe(producto) === 'unidad' ? ' u.' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          {importarFactura && (
            <section className="f-stock-seccion" aria-labelledby="stock-otras-titulo">
              <h2 id="stock-otras-titulo" className="f-seccion">¿Tenés la factura? Cargala con una foto</h2>
              <SubirFactura />
            </section>
          )}
        </div>
      )}

      {vista === 'precios' && <ActualizarPrecios />}
    </div>
  )
}
