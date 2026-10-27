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
import { HerramientasCatalogo } from './HerramientasCatalogo'
import { EscanearCodigoProducto } from './EscanearCodigoProducto'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'

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

  return (
    <div className="page-stock px-5 pt-6">
      <div className="page-module-head">
        <div><span className="page-kicker">Operación</span><h1 className="page-title">Stock</h1><p className="page-description">Controlá existencias, costos y precios desde un solo lugar.</p></div>
        <div className="page-head-stat"><strong>{productos.length}</strong><span>productos</span></div>
      </div>
      {faltan.length > 0 && (
        <div
          className="stock-alert mb-5 rounded-xl px-3.5 py-3 text-[13px]"
          style={{ background: 'var(--ambar-fondo)', color: 'var(--ambar)', border: '1px solid var(--ambar)' }}
        >
          Te está faltando: {faltan.map((producto) => producto.nombre).join(', ')}.
        </div>
      )}

      <div className="stock-tabs flex gap-2">
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

      <div className={`stock-content stock-content-${pestaña}`}>
      {pestaña === 'catalogo' && <><CatalogoStock productos={productos} onCargar={() => setPestaña('cargar')} />{importarCatalogo && <HerramientasCatalogo productos={productos} />}</>}

      {pestaña === 'cargar' && (
        <div className="mt-4">
          <div className="stock-load-layout">
            <section className="stock-load-form">
              <div className="stock-load-heading"><div><span>Nuevo artículo</span><h2>Cargar producto</h2></div>{codigoEscaneado && <span className="stock-code-chip">Código leído</span>}</div>
              {avisoCodigo && <p className="stock-code-notice" role="status">{avisoCodigo}</p>}
              <FormularioProducto key={codigoEscaneado ?? 'manual'} codigoInicial={codigoEscaneado} onGuardado={() => setPestaña('catalogo')} />
            </section>
            {escanerStock && <aside className="stock-scan-panel">
                <EscanearCodigoProducto onDetectar={(codigo) => {
                  const existente = productos.find((producto) => producto.codigoBarras === codigo)
                  setCodigoEscaneado(codigo)
                  setAvisoCodigo(existente ? `Este código ya pertenece a ${existente.nombre}. Podés editarlo desde el catálogo.` : `Código ${codigo} leído. Completá los datos para guardar el producto.`)
                }} />
                <p className="stock-scan-help">También podés escribir o pegar el código en el formulario.</p>
              </aside>}
          </div>

          {importarFactura && <>
            <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
              Cargar desde una factura
            </h2>
            <div className="mt-2">
              <SubirFactura />
            </div>
          </>}
        </div>
      )}

      {pestaña === 'precios' && (
        <div className="mt-4">
          <ActualizarPrecios />
        </div>
      )}
      </div>
    </div>
  )
}
