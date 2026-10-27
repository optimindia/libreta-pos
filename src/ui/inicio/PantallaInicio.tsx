'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { hayPendientes } from '@/datos/local/cola'
import { nubeActiva } from '@/datos/nube/cliente'
import { formatearPesos } from '@/dominio/dinero'
import { resumenDelDia } from '@/dominio/ganancia'
import { deudaPorCliente } from '@/dominio/fiado'
import { compararConLaSemanaPasada, fechaLarga } from '@/dominio/comparar'
import {
  alturasDeBarras, fiadosVencidos, listaCorta, mejorFranja, porReponer, saludo, ventasPorFranja,
} from '@/dominio/inicio'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { ChipEstado } from '@/ui/sistema/ChipEstado'
import { Entrar } from '@/ui/vender/Entrar'
import { IconoCamara, IconoFlechaDerecha, IconoMasCantidad, IconoVender } from '@/ui/sistema/iconos'

const HORAS_DE_LAS_FRANJAS = ['6 a 8', '8 a 10', '10 a 12', '12 a 14', '14 a 16', '16 a 18', '18 a 20', '20 a 22']

/** Lo primero que ve el almacenero al abrir: arriba de todo, VENDER, grande y
 *  inconfundible; abajo, lo que necesita saber de un vistazo (cuánto lleva,
 *  cuánto le deben, qué se le acaba, cómo viene la caja). */
export function PantallaInicio() {
  const [deCero, setDeCero] = useState(false)
  const { funciones } = useFuncionesNegocio()
  const datos = useLiveQuery(async () => {
    const [ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas] = await Promise.all([
      repos.ventas.todas(),
      db.fiados.toArray(),
      repos.fiados.pagos(),
      repos.productos.todos(),
      db.negocio.get('unico'),
      hayPendientes(),
      db.ventas.count(),
    ])
    return { ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas }
  })

  if (!datos) return <div className="mz-pagina" aria-busy="true" />

  const { ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas } = datos
  const aparatoNuevo =
    !deCero && productos.length === 0 && cantidadVentas === 0 && !negocio?.negocioId && nubeActiva()

  const ahora = new Date()
  const resumen = resumenDelDia(ventas, ahora)
  const franjas = ventasPorFranja(ventas, ahora)
  const alturas = alturasDeBarras(franjas)
  const mejor = mejorFranja(franjas)
  const contraSemanaPasada = compararConLaSemanaPasada(ventas, ahora)
  const teDeben = deudaPorCliente(fiados, pagos, ahora.getTime()).reduce((total, deuda) => total + deuda.saldo, 0)
  const vencidos = fiadosVencidos(fiados, pagos, ahora.getTime())
  const reponer = porReponer(productos)
  const efectivoDeHoy = resumen.porMedioPago.efectivo

  const hayPlata = funcionActiva(funciones, 'plata')
  const hayFiados = funcionActiva(funciones, 'fiados')
  const hayStock = funcionActiva(funciones, 'stock')
  const hayFactura = hayStock && funcionActiva(funciones, 'importarFactura')

  const comparacion =
    contraSemanaPasada === null
      ? null
      : contraSemanaPasada >= 0
        ? `${contraSemanaPasada}% más que el mismo día de la semana pasada`
        : `${Math.abs(contraSemanaPasada)}% menos que el mismo día de la semana pasada`

  const nombre = negocio?.nombre?.trim() || 'Tu almacén'

  return (
    <div className="mz-pagina">
      <header className="mz-saludo">
        <div>
          <p className="mz-fecha">{fechaLarga(ahora)} · {nombre}</p>
          <h1 className="mz-titulo">{saludo(ahora.getHours())}</h1>
        </div>
        <ChipEstado pendientes={pendientes} />
      </header>

      {aparatoNuevo && <Entrar onListo={() => setDeCero(true)} />}

      <div className="mz-bento">
        <Link href="/vender" className="mz-vender mz-toque">
          <span className="mz-vender-icono"><IconoVender /></span>
          <span className="mz-vender-texto">
            <strong>Vender</strong>
            <small>Escaneá o tocá los productos</small>
          </span>
          <span className="mz-vender-flecha" aria-hidden="true"><IconoFlechaDerecha /></span>
        </Link>

        <Link href={hayPlata ? '/plata' : '/'} className="mz-baldosa mz-hero mz-ancho">
          <span className="mz-hero-fila">
            <span className="mz-etiqueta">Vendiste hoy</span>
            <span className="mz-ficha">Ganaste {formatearPesos(resumen.ganancia)}</span>
          </span>
          <span className="mz-hero-monto tabular">{formatearPesos(resumen.vendido)}</span>
          <span className="mz-hero-detalle">
            {resumen.cantidadVentas === 0
              ? 'Todavía no vendiste nada hoy'
              : `${resumen.cantidadVentas} ${resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}${comparacion ? ` · ${comparacion}` : ''}`}
          </span>
          <span className="mz-barras" role="img" aria-label={mejor === null ? 'Sin ventas todavía' : `Lo que más vendiste fue entre las ${HORAS_DE_LAS_FRANJAS[mejor]}`}>
            {alturas.map((alto, i) => (
              <span key={i} className={`mz-barra${i === mejor ? ' mz-barra-fuerte' : ''}`} style={{ height: `${alto}%` }} />
            ))}
          </span>
        </Link>

        {hayFiados && (
          <Link href="/fiados" className="mz-baldosa mz-arena">
            <span className="mz-etiqueta">Te deben</span>
            <span>
              <span className="mz-monto tabular">{formatearPesos(teDeben)}</span>
              <span className="mz-nota">
                {vencidos.cantidad > 0
                  ? <><span className="mz-punto" aria-hidden="true" />{vencidos.cantidad} {vencidos.cantidad === 1 ? 'vencido' : 'vencidos'}</>
                  : teDeben > 0 ? 'Todo al día' : 'Nadie te debe'}
              </span>
            </span>
          </Link>
        )}

        {hayStock && (
          <Link href="/stock" className="mz-baldosa mz-coral">
            <span className="mz-etiqueta">{productos.length === 0 ? 'Mercadería' : 'Por reponer'}</span>
            <span>
              <span className={`mz-monto tabular${productos.length === 0 ? ' mz-monto-texto' : ''}`}>{productos.length === 0 ? 'Cargá tus productos' : reponer.cantidad}</span>
              <span className="mz-nota">
                {productos.length === 0
                  ? 'Sin esto no hay qué vender'
                  : reponer.cantidad === 0 ? 'Todo en orden' : listaCorta(reponer.nombres)}
              </span>
            </span>
          </Link>
        )}

        {hayPlata && (
          <div className="mz-baldosa mz-blanca mz-ancho mz-caja">
            <div>
              <span className="mz-etiqueta">Efectivo de hoy</span>
              <span className="mz-monto tabular">{formatearPesos(efectivoDeHoy)}</span>
            </div>
            <Link href="/plata" className="mz-boton-oscuro mz-toque">Cerrar caja</Link>
          </div>
        )}

        {hayFactura && (
          <Link href="/stock" className="mz-atajo mz-toque">
            <IconoCamara />
            <span>Foto de factura</span>
          </Link>
        )}
        {hayPlata && (
          <Link href="/plata" className="mz-atajo mz-toque">
            <IconoMasCantidad />
            <span>Anotar un gasto</span>
          </Link>
        )}
      </div>
    </div>
  )
}
