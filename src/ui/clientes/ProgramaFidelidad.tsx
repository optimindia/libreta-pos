'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { formatearPesos, pesosACentavos, pesosDeTexto } from '@/dominio/dinero'
import { FIDELIDAD_INICIAL, normalizarFidelidad, textoPremio } from '@/dominio/fidelidad'
import { Boton } from '@/ui/sistema/Boton'
import { Hoja } from '@/ui/sistema/Hoja'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'

/** La décima gratis: el dueño la prende y elige cada cuántas compras y qué
 *  premio. Los sellos se cuentan solos con las ventas a cada cliente. */
export function ProgramaFidelidad() {
  const [ajustes, cambiar] = useAjustesNegocio()
  const [editando, setEditando] = useState(false)
  const config = ajustes.fidelidad ?? FIDELIDAD_INICIAL
  const [cada, setCada] = useState(String(config.cadaCompras))
  const [minimo, setMinimo] = useState(config.minimo ? String(config.minimo / 100) : '')
  const [tipo, setTipo] = useState<'porcentaje' | 'pesos'>(config.premio.tipo)
  const [valor, setValor] = useState(String(config.premio.tipo === 'pesos' ? config.premio.valor / 100 : config.premio.valor))
  const [aviso, setAviso] = useState<string | null>(null)

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const numero = Number(valor.replace(',', '.'))
    const nuevo = normalizarFidelidad({
      activa: true,
      cadaCompras: Number(cada),
      minimo: minimo.trim() ? pesosACentavos(pesosDeTexto(minimo)) : 0,
      premio: { tipo, valor: tipo === 'pesos' ? pesosACentavos(numero) : numero },
    })
    if (!nuevo) {
      setAviso('Revisá los datos: entre 2 y 100 compras, y un premio mayor a cero (hasta 100%).')
      return
    }
    cambiar({ fidelidad: nuevo })
    setEditando(false)
  }

  return (
    <Tarjeta como="section" className="f-fidelidad" aria-labelledby="fidelidad-titulo">
      <div className="f-fidelidad-cabeza">
        <div>
          <h2 id="fidelidad-titulo" className="f-seccion">La décima gratis</h2>
          <p className="f-dato">
            {config.activa
              ? `Cada ${config.cadaCompras} compras${config.minimo ? ` de ${formatearPesos(config.minimo)} o más` : ''}, ${textoPremio(config.premio, formatearPesos)} en la siguiente.`
              : 'Premiá a los que vuelven: cada tantas compras, un descuento. Los sellos se cuentan solos al elegir el cliente en la venta.'}
          </p>
        </div>
        <div className="f-fidelidad-acciones">
          {config.activa && <Boton variante="secundario" onClick={() => cambiar({ fidelidad: { ...config, activa: false } })}>Pausar</Boton>}
          <Boton variante={config.activa ? 'secundario' : 'principal'} onClick={() => { setAviso(null); setEditando(true) }}>{config.activa ? 'Cambiar' : 'Activar'}</Boton>
        </div>
      </div>
      {editando && createPortal(
        <Hoja abierta onCerrar={() => setEditando(false)} titulo="La décima gratis" ancho="angosto">
          <form className="f-fidelidad-form" onSubmit={guardar}>
            <label className="f-campo">
              <span>Cada cuántas compras</span>
              <input aria-label="Cada cuántas compras" inputMode="numeric" className="f-entrada" value={cada} onChange={(evento) => setCada(evento.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="f-campo">
              <span>Compra mínima para sumar <em>opcional</em></span>
              <div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label="Compra mínima" inputMode="decimal" className="f-entrada" placeholder="Cualquier compra" value={minimo} onChange={(evento) => setMinimo(evento.target.value)} /></div>
            </label>
            <span className="f-campo-titulo">Premio</span>
            <Segmentado etiqueta="Tipo de premio" opciones={[{ valor: 'porcentaje', texto: '% de descuento' }, { valor: 'pesos', texto: '$ de descuento' }]} valor={tipo} onCambiar={setTipo} />
            <label className="f-campo">
              <span>{tipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}</span>
              <input aria-label="Valor del premio" inputMode="decimal" className="f-entrada" value={valor} onChange={(evento) => setValor(evento.target.value)} />
            </label>
            {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
            <Boton type="submit" variante="principal" ancho>Guardar y activar</Boton>
          </form>
        </Hoja>,
        document.body,
      )}
    </Tarjeta>
  )
}
