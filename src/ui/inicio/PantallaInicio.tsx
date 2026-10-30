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
import { rolDe } from '@/dominio/roles'
import { deudaPorCliente } from '@/dominio/fiado'
import { compararConLaSemanaPasada, fechaLarga } from '@/dominio/comparar'
import {
  detalleFranjas, fiadosVencidos, listaCorta, porDebajoDelCosto, porReponer, saludo,
} from '@/dominio/inicio'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { clasesBoton } from '@/ui/sistema/Boton'
import { Entrar } from '@/ui/vender/Entrar'
import { IconoCamara, IconoFlechaDerecha, IconoMasCantidad, IconoVender } from '@/ui/sistema/iconos'
import type { Venta } from '@/dominio/tipos'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'
import { GraficoHoras } from './GraficoHoras'
import { PrimerosPasos, pasosDeLaGuia } from './PrimerosPasos'

const MEDIO: Record<Venta['medioPago'], string> = { efectivo: 'efectivo', transferencia: 'transferencia', qr: 'QR', fiado: 'fiado' }
const HORA = new Intl.DateTimeFormat('es-AR', { hour: 'numeric', minute: '2-digit', hour12: false })

/** Lo primero que ve el almacenero al abrir: arriba de todo, VENDER, grande y
 *  inconfundible; abajo, lo que necesita saber de un vistazo (cuánto lleva,
 *  cuánto le deben, qué se le acaba, cómo viene la caja). */
export function PantallaInicio() {
  const [deCero, setDeCero] = useState(false)
  const { funciones } = useFuncionesNegocio()
  const datos = useLiveQuery(async () => {
    const [ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas, clientes] = await Promise.all([
      repos.ventas.todas(),
      db.fiados.toArray(),
      repos.fiados.pagos(),
      repos.productos.todos(),
      db.negocio.get('unico'),
      hayPendientes(),
      db.ventas.count(),
      repos.clientes.todos(),
    ])
    return { ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas, clientes }
  })

  if (!datos) return <div className="fi-pagina"><EstadoCarga texto="Preparando tu inicio…" /></div>

  const { ventas, fiados, pagos, productos, negocio, pendientes, cantidadVentas, clientes } = datos
  const aparatoNuevo =
    !deCero && productos.length === 0 && cantidadVentas === 0 && !negocio?.negocioId && nubeActiva()

  const ahora = new Date()
  const resumen = resumenDelDia(ventas, ahora)
  const franjas = detalleFranjas(ventas, ahora)
  const bajoCosto = porDebajoDelCosto(ventas, ahora)
  const contraSemanaPasada = compararConLaSemanaPasada(ventas, ahora)
  const teDeben = deudaPorCliente(fiados, pagos, ahora.getTime()).reduce((total, deuda) => total + deuda.saldo, 0)
  const vencidos = fiadosVencidos(fiados, pagos, ahora.getTime())
  const reponer = porReponer(productos)
  const medios = resumen.porMedioPago
  const qrYTransferencia = medios.qr + medios.transferencia
  const porcentajeDe = (monto: number) => (resumen.vendido > 0 ? Math.max(2, Math.round((monto / resumen.vendido) * 100)) : 0)
  const ultimas = [...ventas]
    .filter((venta) => venta.estado !== 'anulada')
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, 3)
  const nombreCliente = (id: string | null) => clientes.find((cliente) => cliente.id === id)?.nombre

  const esDueno = rolDe(negocio?.rol) === 'dueno'
  // El vendedor no ve ganancias ni la caja: eso es del dueño.
  const hayPlata = esDueno && funcionActiva(funciones, 'plata')
  const hayFiados = funcionActiva(funciones, 'fiados')
  const hayStock = funcionActiva(funciones, 'stock')
  const hayFactura = esDueno && hayStock && funcionActiva(funciones, 'importarFactura')

  const comparacion =
    contraSemanaPasada === null
      ? null
      : contraSemanaPasada >= 0
        ? `${contraSemanaPasada}% más que el mismo día de la semana pasada`
        : `${Math.abs(contraSemanaPasada)}% menos que el mismo día de la semana pasada`

  const nombre = negocio?.nombre?.trim() || 'Tu almacén'

  return (
    <div className="fi-pagina">
      <header className="fi-cabeza">
        <div className="fi-cabeza-texto">
          <p className="f-dato">{fechaLarga(ahora)} · {nombre}</p>
          <h1 className="f-titulo">{saludo(ahora.getHours())}</h1>
        </div>
        <Etiqueta tono={pendientes ? 'ambar' : 'verde'} punto>{pendientes ? 'Guardado' : 'Al día'}</Etiqueta>
      </header>

      {aparatoNuevo && <Entrar onListo={() => setDeCero(true)} />}

      <div className="fi-grilla">
        <Link href="/vender" className="fi-vender">
          <span className="fi-vender-icono"><IconoVender /></span>
          <span className="fi-vender-texto">
            <strong>Vender</strong>
            <small>Escaneá o tocá los productos</small>
          </span>
          <span className="fi-vender-flecha" aria-hidden="true"><IconoFlechaDerecha /></span>
        </Link>

        {esDueno && productos.length === 0 && (
          <EstadoVacio
            className="fi-vacio"
            titulo="Todavía no cargaste productos"
            texto="Cargá el primero o importá tu lista para empezar a vender."
            accion={{ etiqueta: 'Cargar producto', href: '/stock' }}
          />
        )}

        <PrimerosPasos
          negocioId={negocio?.negocioId}
          pasos={pasosDeLaGuia({
            esDueno,
            productos: productos.length,
            ventas: cantidadVentas,
            nombreConfigurado: nombre !== 'Tu almacén',
          })}
        />

        <Tarjeta como="section" className="fi-hoy" aria-label="Resumen de hoy">
          <span className="f-dato">Vendiste hoy</span>
          <span className="f-plata f-plata-36 fi-hoy-monto">{formatearPesos(resumen.vendido)}</span>
          <span className="f-texto fi-hoy-detalle">
            {resumen.cantidadVentas === 0
              ? 'Todavía no vendiste nada hoy'
              : `${resumen.cantidadVentas} ${resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}${comparacion ? ` · ${comparacion}` : ''}`}
          </span>
          <GraficoHoras franjas={franjas} />
          {esDueno && (
            <div className="fi-ganancia">
              {bajoCosto.length > 0 ? (
                <>
                  <Etiqueta tono="ambar">Ganancia {formatearPesos(resumen.ganancia)}</Etiqueta>
                  <Link href="/stock" className="fi-ganancia-nota">
                    Vendiste por debajo del costo: {listaCorta(bajoCosto)}. Revisá los costos.
                  </Link>
                </>
              ) : (
                <Etiqueta tono="verde">Ganaste {formatearPesos(resumen.ganancia)}</Etiqueta>
              )}
              {hayPlata && <Link href="/plata" className="fi-enlace">Ver mi plata</Link>}
            </div>
          )}
        </Tarjeta>

        {hayFiados && (
          <Link href="/fiados" className="fi-aviso fi-deben" data-tono="coral">
            <span className="f-dato">Te deben</span>
            <span className="fi-aviso-ayuda">Lo que tus clientes todavía no pagaron</span>
            <span className="f-plata f-plata-36 fi-aviso-monto">{formatearPesos(teDeben)}</span>
            <span className="fi-aviso-nota">
              {vencidos.cantidad > 0
                ? <>{vencidos.cantidad} {vencidos.cantidad === 1 ? 'vencido' : 'vencidos'}</>
                : teDeben > 0 ? 'Todo al día' : 'Nadie te debe'}
            </span>
            <span className="fi-aviso-ir">Ver fiados <IconoFlechaDerecha /></span>
          </Link>
        )}

        {hayPlata && (
          <Tarjeta como="section" className="fi-caja" aria-label="Caja de hoy">
            <h2 className="f-seccion">Caja de hoy</h2>
            <p className="fi-seccion-ayuda f-texto">Cómo entró la plata: en mano, por QR o transferencia, o anotada en fiado.</p>
            <FilaMedio nombre="Efectivo" monto={medios.efectivo} ancho={porcentajeDe(medios.efectivo)} tono="verde" />
            <FilaMedio nombre="QR y transferencia" monto={qrYTransferencia} ancho={porcentajeDe(qrYTransferencia)} tono="tinta" />
            <FilaMedio nombre="Fiado" monto={medios.fiado} ancho={porcentajeDe(medios.fiado)} tono="coral" />
            <Link href="/plata" className={clasesBoton('secundario', 'fi-caja-boton')}>Cerrar caja</Link>
          </Tarjeta>
        )}

        {hayStock && (
          <Link href="/stock" className="fi-aviso fi-reponer" data-tono="ambar">
            <span className="f-dato">{productos.length === 0 ? 'Mercadería' : 'Por reponer'}</span>
            <span className="fi-aviso-ayuda">{productos.length === 0 ? 'Lo que tenés para vender' : 'Productos que se están por acabar'}</span>
            <span className={`f-plata f-plata-36 fi-aviso-monto${productos.length === 0 ? ' fi-aviso-texto' : ''}`}>{productos.length === 0 ? 'Cargá tus productos' : reponer.cantidad}</span>
            <span className="fi-aviso-nota">
              {productos.length === 0
                ? 'Sin esto no hay qué vender'
                : reponer.cantidad === 0 ? 'Todo en orden' : listaCorta(reponer.nombres)}
            </span>
            <span className="fi-aviso-ir">Ver stock <IconoFlechaDerecha /></span>
          </Link>
        )}

        {ultimas.length > 0 && (
          <Tarjeta como="section" className="fi-ultimas" aria-label="Últimas ventas">
            <div className="fi-ultimas-cabeza">
              <h2 className="f-seccion">Últimas ventas</h2>
              <Link href="/historial" className="fi-enlace">Ver todas</Link>
            </div>
            <ul className="fi-ultimas-lista">
              {ultimas.map((venta) => (
                <li key={venta.id} className="f-renglon">
                  <span className="f-renglon-cuerpo">
                    <span className="f-renglon-titulo">{venta.items.map((item) => (item.cantidad > 1 ? `${item.nombre} ×${item.cantidad}` : item.nombre)).join(', ')}</span>
                    <span className="f-renglon-detalle" data-tono={venta.medioPago === 'fiado' ? 'coral' : undefined}>
                      {HORA.format(new Date(venta.fecha))} · {MEDIO[venta.medioPago]}{venta.medioPago === 'fiado' && nombreCliente(venta.clienteId) ? ` a ${nombreCliente(venta.clienteId)}` : ''}
                    </span>
                  </span>
                  <span className="f-renglon-fin">{formatearPesos(venta.total)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        {(hayFactura || hayPlata) && (
          <div className="fi-atajos">
            {hayFactura && (
              <Link href="/stock" className={clasesBoton('secundario')}>
                <IconoCamara />
                <span>Foto de factura</span>
              </Link>
            )}
            {hayPlata && (
              <Link href="/plata" className={clasesBoton('secundario')}>
                <IconoMasCantidad />
                <span>Anotar un gasto</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FilaMedio({ nombre, monto, ancho, tono }: { nombre: string; monto: number; ancho: number; tono: 'verde' | 'tinta' | 'coral' }) {
  return (
    <div className="fi-medio" data-tono={tono}>
      <span className="fi-medio-fila">
        <span className="f-texto">{nombre}{monto > 0 && <small className="fi-medio-pct"> {Math.min(100, ancho)}%</small>}</span>
        <span className="f-plata f-plata-16 fi-medio-monto">{formatearPesos(monto)}</span>
      </span>
      <span className="fi-medio-barra" aria-hidden="true"><span style={{ width: `${ancho}%` }} /></span>
    </div>
  )
}
