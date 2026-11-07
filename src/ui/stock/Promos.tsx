'use client'

import { useMemo, useState } from 'react'
import { nuevoId } from '@/dominio/id'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { promoValida, resumenPromo, type Promo } from '@/dominio/promos'
import type { Producto } from '@/dominio/tipos'
import { Boton } from '@/ui/sistema/Boton'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { Hoja } from '@/ui/sistema/Hoja'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'

type Tipo = Promo['tipo']

const TIPOS: Array<{ valor: Tipo; texto: string }> = [
  { valor: 'nxm', texto: '3x2' },
  { valor: 'cantidad', texto: '% por cantidad' },
  { valor: 'combo', texto: 'Combo' },
]

function SelectorProducto({ productos, valor, onCambiar, etiqueta }: { productos: Producto[]; valor: string; onCambiar: (id: string) => void; etiqueta: string }) {
  return (
    <select aria-label={etiqueta} className="f-entrada" value={valor} onChange={(evento) => onCambiar(evento.target.value)}>
      <option value="">Elegí un producto</option>
      {productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre} · {formatearPesos(producto.precio)}</option>)}
    </select>
  )
}

function FormularioPromo({ productos, onGuardar, onCerrar }: { productos: Producto[]; onGuardar: (promo: Promo) => void; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<Tipo>('nxm')
  const [productoId, setProductoId] = useState('')
  const [lleva, setLleva] = useState('3')
  const [paga, setPaga] = useState('2')
  const [desde, setDesde] = useState('6')
  const [porcentaje, setPorcentaje] = useState('10')
  const [partes, setPartes] = useState<Array<{ productoId: string; cantidad: string }>>([{ productoId: '', cantidad: '1' }, { productoId: '', cantidad: '1' }])
  const [precioCombo, setPrecioCombo] = useState('')
  const [nombre, setNombre] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const nombreDe = (id: string) => productos.find((producto) => producto.id === id)?.nombre ?? ''
  const regularCombo = partes.reduce((total, parte) => total + (productos.find((p) => p.id === parte.productoId)?.precio ?? 0) * (Number(parte.cantidad) || 0), 0)

  function armar(): Promo | null {
    const id = nuevoId()
    if (tipo === 'nxm') {
      const n = Number(lleva)
      const m = Number(paga)
      return { id, activa: true, tipo, productoId, lleva: n, paga: m, nombre: nombre.trim() || `${n}x${m} ${nombreDe(productoId)}` }
    }
    if (tipo === 'cantidad') {
      const d = Number(desde)
      const pct = Number(porcentaje.replace(',', '.'))
      return { id, activa: true, tipo, productoId, desde: d, porcentaje: pct, nombre: nombre.trim() || `${pct}% ${nombreDe(productoId)} x${d}` }
    }
    const lista = partes.filter((parte) => parte.productoId).map((parte) => ({ productoId: parte.productoId, cantidad: Number(parte.cantidad) }))
    return { id, activa: true, tipo, partes: lista, precio: pesosACentavos(pesosDeTexto(precioCombo)), nombre: nombre.trim() || `Combo ${lista.map((parte) => nombreDe(parte.productoId).split(' ')[0]).join(' + ')}` }
  }

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const promo = armar()
    if (!promo || !promoValida(promo)) {
      setAviso(tipo === 'nxm'
        ? 'Elegí el producto y que lleve más de lo que paga (por ejemplo, lleva 3 y paga 2).'
        : tipo === 'cantidad'
          ? 'Elegí el producto, desde cuántas unidades (2 o más) y un porcentaje entre 1 y 99.'
          : 'Elegí al menos dos productos distintos y el precio del combo.')
      return
    }
    if (promo.tipo === 'combo' && promo.precio >= regularCombo) {
      setAviso(`El combo tiene que salir menos que ${formatearPesos(regularCombo)}, lo que cuestan por separado.`)
      return
    }
    onGuardar(promo)
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Nueva promoción" ancho="angosto">
      <form className="f-promo-form" onSubmit={guardar}>
        <Segmentado etiqueta="Tipo de promoción" opciones={TIPOS} valor={tipo} onCambiar={(valor) => { setTipo(valor); setAviso(null) }} />
        {tipo !== 'combo' && (
          <label className="f-campo"><span>Producto</span><SelectorProducto productos={productos} valor={productoId} onCambiar={setProductoId} etiqueta="Producto de la promoción" /></label>
        )}
        {tipo === 'nxm' && (
          <div className="f-promo-dos">
            <label className="f-campo"><span>Lleva</span><input aria-label="Lleva" inputMode="numeric" className="f-entrada" value={lleva} onChange={(evento) => setLleva(evento.target.value.replace(/\D/g, ''))} /></label>
            <label className="f-campo"><span>Paga</span><input aria-label="Paga" inputMode="numeric" className="f-entrada" value={paga} onChange={(evento) => setPaga(evento.target.value.replace(/\D/g, ''))} /></label>
          </div>
        )}
        {tipo === 'cantidad' && (
          <div className="f-promo-dos">
            <label className="f-campo"><span>Desde</span><input aria-label="Desde cuántas unidades" inputMode="numeric" className="f-entrada" value={desde} onChange={(evento) => setDesde(evento.target.value.replace(/\D/g, ''))} /></label>
            <label className="f-campo"><span>Descuento %</span><input aria-label="Porcentaje de descuento" inputMode="decimal" className="f-entrada" value={porcentaje} onChange={(evento) => setPorcentaje(evento.target.value)} /></label>
          </div>
        )}
        {tipo === 'combo' && (
          <>
            {partes.map((parte, indice) => (
              <div key={indice} className="f-promo-parte">
                <SelectorProducto productos={productos} valor={parte.productoId} etiqueta={`Producto ${indice + 1} del combo`} onCambiar={(id) => setPartes(partes.map((p, i) => (i === indice ? { ...p, productoId: id } : p)))} />
                <input aria-label={`Cantidad del producto ${indice + 1}`} inputMode="numeric" className="f-entrada" value={parte.cantidad} onChange={(evento) => setPartes(partes.map((p, i) => (i === indice ? { ...p, cantidad: evento.target.value.replace(/\D/g, '') } : p)))} />
              </div>
            ))}
            {partes.length < 5 && <button type="button" className="f-promo-agregar" onClick={() => setPartes([...partes, { productoId: '', cantidad: '1' }])}>+ Otro producto</button>}
            <label className="f-campo">
              <span>Precio del combo {regularCombo > 0 && <em>por separado {formatearPesos(regularCombo)}</em>}</span>
              <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Precio del combo" inputMode="decimal" className="f-entrada" value={precioCombo} onChange={(evento) => setPrecioCombo(evento.target.value)} /></div>
            </label>
          </>
        )}
        <label className="f-campo"><span>Nombre <em>opcional, sale en el ticket</em></span><input aria-label="Nombre de la promoción" className="f-entrada" maxLength={60} placeholder="Se arma solo si lo dejás vacío" value={nombre} onChange={(evento) => setNombre(evento.target.value)} /></label>
        {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
        <Boton type="submit" variante="principal" ancho>Guardar promoción</Boton>
      </form>
    </Hoja>
  )
}

/** Las promociones del negocio: se aplican solas en Vender. */
export function Promos({ productos }: { productos: Producto[] }) {
  const [ajustes, cambiar] = useAjustesNegocio()
  const [creando, setCreando] = useState(false)
  const promos = ajustes.promos ?? []
  const ordenados = useMemo(() => [...productos].filter((p) => p.precio > 0).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [productos])
  const existe = (id: string) => productos.some((producto) => producto.id === id)

  function guardarTodas(siguientes: Promo[]) {
    cambiar({ promos: siguientes })
  }

  return (
    <Tarjeta como="section" className="f-promos" aria-labelledby="promos-titulo">
      <div className="f-promos-cabeza">
        <div>
          <h2 id="promos-titulo" className="f-seccion">Promociones</h2>
          <p className="f-dato">Se aplican solas al cobrar cuando el ticket cumple la condición.</p>
        </div>
        <Boton variante="secundario" onClick={() => setCreando(true)} disabled={ordenados.length === 0}>+ Nueva</Boton>
      </div>
      {promos.length === 0 ? (
        <EstadoVacio compacto titulo="Todavía no hay promociones" texto="Armá un 3x2, un descuento por cantidad o un combo." />
      ) : (
        <ul className="f-promos-lista">
          {promos.map((promo) => {
            const rota = promo.tipo === 'combo' ? promo.partes.some((parte) => !existe(parte.productoId)) : !existe(promo.productoId)
            return (
              <li key={promo.id} data-inactiva={!promo.activa || rota ? 'true' : undefined}>
                <span className="f-promos-textos">
                  <strong>{promo.nombre}</strong>
                  <span>{rota ? 'Un producto de esta promo ya no está en el catálogo' : promo.nombre.startsWith(resumenPromo(promo, formatearPesos)) ? 'Automática al cobrar' : resumenPromo(promo, formatearPesos)}</span>
                </span>
                <span className="f-promos-acciones">
                <label className="f-promos-interruptor">
                  <input type="checkbox" checked={promo.activa} onChange={(evento) => guardarTodas(promos.map((p) => (p.id === promo.id ? { ...p, activa: evento.target.checked } : p)))} />
                  <span>{promo.activa ? 'Activa' : 'Pausada'}</span>
                </label>
                <button type="button" className="f-promos-quitar" aria-label={`Quitar ${promo.nombre}`} onClick={() => guardarTodas(promos.filter((p) => p.id !== promo.id))}>Quitar</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {creando && <FormularioPromo productos={ordenados} onCerrar={() => setCreando(false)} onGuardar={(promo) => { guardarTodas([...promos, promo]); setCreando(false) }} />}
    </Tarjeta>
  )
}
