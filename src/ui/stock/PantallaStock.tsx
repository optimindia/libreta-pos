'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { faltantes } from '@/dominio/stock'
import { valorStock } from '@/dominio/reportes'
import { formatearPesos } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'
import { Chip, Chips } from '@/ui/sistema/Chip'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { FormularioProducto } from './FormularioProducto'
import { SubirFactura } from './SubirFactura'
import { ActualizarPrecios } from './ActualizarPrecios'
import { CatalogoStock } from './CatalogoStock'
import { HerramientasCatalogo } from './HerramientasCatalogo'
import { EscanearCodigoProducto } from './EscanearCodigoProducto'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { usePuede } from '@/ui/sistema/usoRol'
import './stock.css'

type Pestaña = 'catalogo' | 'cargar' | 'precios'

export function PantallaStock() {
  const [pestaña, setPestaña] = useState<Pestaña>('catalogo')
  const [codigoEscaneado, setCodigoEscaneado] = useState<string | undefined>()
  const [avisoCodigo, setAvisoCodigo] = useState<string | null>(null)
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
      <header className="f-stock-cabecera">
        <div className="f-stock-titulo">
          <h1 className="f-titulo">Stock</h1>
          <p className="f-texto f-stock-subtitulo">
            {cuantos}
            {editaCatalogo && productos.length > 0 && <> · mercadería por {formatearPesos(inventario.costo)} a costo</>}
          </p>
        </div>
        {editaCatalogo && vista === 'catalogo' && productos.length > 0 && (
          <Boton variante="principal" className="f-stock-llego" onClick={() => setPestaña('cargar')}>+ Llegó mercadería</Boton>
        )}
      </header>

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
                <h2 id="stock-cargar-titulo" className="f-seccion">Cargar producto</h2>
                {codigoEscaneado && <span className="f-etiqueta" data-tono="verde">Código leído</span>}
              </div>
              {avisoCodigo && <p className="f-aviso" data-tono="ambar" role="status">{avisoCodigo}</p>}
              <FormularioProducto key={codigoEscaneado ?? 'manual'} codigoInicial={codigoEscaneado} onGuardado={() => setPestaña('catalogo')} />
            </Tarjeta>
            {escanerStock && (
              <aside className="f-stock-lateral">
                <EscanearCodigoProducto onDetectar={(codigo) => {
                  const existente = productos.find((producto) => producto.codigoBarras === codigo)
                  setCodigoEscaneado(codigo)
                  setAvisoCodigo(existente ? `Este código ya pertenece a ${existente.nombre}. Podés editarlo desde el catálogo.` : `Código ${codigo} leído. Completá los datos para guardar el producto.`)
                }} />
                <p className="f-dato">También podés escribir o pegar el código en el formulario.</p>
              </aside>
            )}
          </div>

          {importarFactura && (
            <section className="f-stock-seccion" aria-labelledby="stock-factura-titulo">
              <h2 id="stock-factura-titulo" className="f-seccion">Cargar desde una factura</h2>
              <SubirFactura />
            </section>
          )}
        </div>
      )}

      {vista === 'precios' && <ActualizarPrecios />}
    </div>
  )
}
