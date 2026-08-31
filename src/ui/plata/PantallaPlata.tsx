'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '@/datos/local/repos'
import { resumenDelDia, masVendidos } from '@/dominio/ganancia'
import { listaDeCompra } from '@/dominio/reposicion'
import { mensajeCompra, enlaceWhatsApp } from '@/dominio/mensajes'
import { textoDuracion } from '@/dominio/comparar'
import { Importe } from '@/ui/sistema/Importe'
import { CierreCaja } from './CierreCaja'

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', fiado: 'Fiado',
}

export function PantallaPlata() {
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const [ventas, productos] = await Promise.all([
      repos.ventas.todas(),
      repos.productos.todos(),
    ])
    return {
      resumen: resumenDelDia(ventas, new Date(ahora)),
      masVendidos: masVendidos(ventas, new Date(ahora)),
      compras: listaDeCompra(productos, ventas, ahora),
    }
  }, [])

  if (!datos) return null

  return (
    <div className="px-5 pt-6">
      <h1 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Hoy
      </h1>

      <div className="mt-2">
        <div className="text-[11px]" style={{ color: 'var(--tenue)' }}>Vendiste</div>
        <Importe centavos={datos.resumen.vendido} tamaño="grande" />
      </div>

      <div className="mt-3">
        <div className="text-[11px]" style={{ color: 'var(--tenue)' }}>Ganaste</div>
        <Importe centavos={datos.resumen.ganancia} tamaño="grande" style={{ color: 'var(--verde)' }} />
      </div>

      {datos.masVendidos.length > 0 && (
        <>
          <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
            Lo que más vendiste hoy
          </h2>
          <ul className="mt-2 flex gap-2">
            {datos.masVendidos.map((producto, indice) => (
              <li
                key={producto.productoId}
                className="flex-1 rounded-2xl px-3 py-2.5"
                style={{ background: indice === 0 ? 'var(--chip-fondo)' : 'var(--hueso-2)', border: '1px solid var(--linea)' }}
              >
                <div className="truncate text-[12.5px] font-medium">{producto.nombre}</div>
                <div className="tabular text-[11px]" style={{ color: 'var(--tenue)' }}>
                  {producto.unidades} {producto.unidades === 1 ? 'unidad' : 'unidades'}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Cómo te pagaron
      </h2>
      <ul className="mt-2">
        {Object.entries(datos.resumen.porMedioPago).map(([medio, monto]) => (
          <li
            key={medio}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: '1px solid var(--linea)' }}
          >
            <span className="text-[13px]">{NOMBRE_MEDIO[medio]}</span>
            <Importe centavos={monto} tamaño="chico" />
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Caja
      </h2>
      <div className="mt-2">
        <CierreCaja />
      </div>

      <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Tenés que reponer
      </h2>
      {datos.compras.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--tenue)' }}>
          Por ahora no te falta nada.
        </p>
      ) : (
        <>
          <ul className="mt-2">
            {datos.compras.map((compra) => (
              <li
                key={compra.producto.id}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--linea)' }}
              >
                <div className="leading-tight">
                  <div className="text-[13px] font-medium">{compra.producto.nombre}</div>
                  <div className="text-[11px]" style={{ color: 'var(--tenue)' }}>
                    {textoDuracion(compra.diasRestantes)}
                  </div>
                </div>
                <span className="tabular text-[13px] font-semibold">{compra.cantidadSugerida}</span>
              </li>
            ))}
          </ul>
          <a
            className="mt-4 block rounded-2xl py-3.5 text-center text-[14px] font-semibold"
            style={{ background: 'var(--verde)', color: 'var(--verde-texto)' }}
            target="_blank"
            rel="noreferrer"
            href={enlaceWhatsApp('', mensajeCompra(datos.compras))}
          >
            Mandar pedido al proveedor
          </a>
        </>
      )}
    </div>
  )
}
