'use client'

import { useState } from 'react'
import { repos } from '@/datos/local/repos'
import { controlaStock } from '@/dominio/stock'
import type { Producto } from '@/dominio/tipos'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { useAjustesNegocio } from '@/ui/sistema/usoAjustesNegocio'

/** Para el negocio que no cuenta lo que tiene (un lubricentro que vende
 *  suelto, un kiosco chico): apagar o prender el control de stock de todo el
 *  catálogo de una vez, y elegir cómo nacen los productos nuevos. */
export function ControlStockNegocio({ productos }: { productos: Producto[] }) {
  const [ajustes, cambiar] = useAjustesNegocio()
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const sinControl = productos.filter((producto) => !controlaStock(producto)).length
  const conControl = productos.length - sinControl
  const nuevosSinControl = ajustes.sinControlStockPorDefecto === true

  async function todos(controlar: boolean) {
    setTrabajando(true)
    try {
      const cambiados = await repos.productos.cambiarControlStock(productos.map((producto) => producto.id), controlar)
      cambiar({ sinControlStockPorDefecto: !controlar })
      setAviso(cambiados === 0 ? 'Ya estaba así.' : controlar ? `Listo: ahora se lleva la cuenta de ${cambiados} productos.` : `Listo: ${cambiados} productos se venden sin contar el stock.`)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Tarjeta como="section" className="f-control-stock" aria-labelledby="control-stock-titulo">
      <div className="f-control-stock-cabeza">
        <div>
          <h2 id="control-stock-titulo" className="f-seccion">Control de stock</h2>
          <p className="f-dato">
            {sinControl === 0
              ? `Llevás la cuenta de los ${conControl} productos: se descuentan al vender y te avisamos cuando se acaban.`
              : conControl === 0
                ? 'No llevás la cuenta del stock: todo se vende siempre, sin contar cuántos hay.'
                : `${conControl} con control de stock y ${sinControl} sin control. Se cambia de a uno en la ficha del producto.`}
          </p>
        </div>
        <div className="f-control-stock-acciones">
          {conControl > 0 && <Boton variante="secundario" disabled={trabajando} onClick={() => void todos(false)}>No controlar ninguno</Boton>}
          {sinControl > 0 && <Boton variante="secundario" disabled={trabajando} onClick={() => void todos(true)}>Controlar todos</Boton>}
        </div>
      </div>
      <label className="f-stock-control">
        <input type="checkbox" checked={nuevosSinControl} onChange={(evento) => cambiar({ sinControlStockPorDefecto: evento.target.checked })} />
        <span><strong>Los productos nuevos, sin control de stock</strong><small>Se puede cambiar en cada producto.</small></span>
      </label>
      {aviso && <p className="f-dato" role="status">{aviso}</p>}
    </Tarjeta>
  )
}
