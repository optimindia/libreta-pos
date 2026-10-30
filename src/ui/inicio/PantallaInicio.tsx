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
  detalleFranjas, fiadosVencidos, listaCorta, porDebajoDelCosto, porReponer, saludo, tareasDeHoy,
} from '@/dominio/inicio'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Entrar } from '@/ui/vender/Entrar'
import {
  IconoAlerta, IconoCamara, IconoCobrar, IconoEfectivo, IconoFiados, IconoFlechaDerecha, IconoGanancia, IconoHistorial,
  IconoConfirmar, IconoHora, IconoMasCantidad, IconoQR, IconoStock, IconoTransferencia, IconoVender, IconoWhatsApp,
} from '@/ui/sistema/iconos'
import type { Tarea } from '@/dominio/inicio'
import type { ComponentType, ReactNode } from 'react'
import type { Venta } from '@/dominio/tipos'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { GraficoHoras } from './GraficoHoras'
import { PrimerosPasos, pasosDeLaGuia } from './PrimerosPasos'

const MEDIO: Record<Venta['medioPago'], string> = { efectivo: 'efectivo', transferencia: 'transferencia', qr: 'QR', fiado: 'fiado' }
const ICONO_MEDIO: Record<Venta['medioPago'], ComponentType> = {
  efectivo: IconoEfectivo, transferencia: IconoTransferencia, qr: IconoQR, fiado: IconoFiados,
}
const HORA = new Intl.DateTimeFormat('es-AR', { hour: 'numeric', minute: '2-digit', hour12: false })

/** Lo primero que ve el almacenero al abrir, en orden de importancia:
 *  VENDER; cuatro números del día con su ícono (vendido, ganancia, lo que le
 *  deben, lo que se acaba); el día hora por hora junto a la caja; y por
 *  último las últimas ventas y los atajos. Cada bloque dice qué es. */
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
  const deudas = deudaPorCliente(fiados, pagos, ahora.getTime())
  const teDeben = deudas.reduce((total, deuda) => total + deuda.saldo, 0)
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

  const tareas = tareasDeHoy({
    esDueno, hayFiados, hayStock, cantidadProductos: productos.length, vencidos, reponer, bajoCosto,
    deudas: deudas.map((deuda) => ({ ...deuda, nombre: nombreCliente(deuda.clienteId) ?? 'Un cliente' })),
  })

  const comparacion =
    contraSemanaPasada === null
      ? null
      : contraSemanaPasada >= 0
        ? `${contraSemanaPasada}% más que el mismo día de la semana pasada`
        : `${Math.abs(contraSemanaPasada)}% menos que el mismo día de la semana pasada`

  const nombre = negocio?.nombre?.trim() || 'Tu almacén'

  return (
    <div className="fi-pagina">
      {aparatoNuevo && <Entrar onListo={() => setDeCero(true)} />}

      <section className="fi-portada" aria-labelledby="fi-saludo">
        <div className="fi-portada-texto">
          <p className="fi-fecha">{fechaLarga(ahora)} · {nombre}</p>
          <h1 id="fi-saludo" className="fi-saludo">{saludo(ahora.getHours())}</h1>
          <p className="fi-llevas-rotulo">Hoy llevás vendido</p>
          <p className="fi-llevas">{formatearPesos(resumen.vendido)}</p>
          <p className="fi-llevas-detalle">
            <span>{resumen.cantidadVentas === 0
              ? 'Todavía no vendiste nada hoy'
              : `${resumen.cantidadVentas} ${resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}`}</span>
            {comparacion && resumen.cantidadVentas > 0 && <span className="fi-llevas-comparacion">{comparacion}</span>}
          </p>
        </div>
        <div className="fi-portada-accion">
          <Link href="/vender" className="fi-vender">
            <span className="fi-vender-icono"><IconoVender /></span>
            <span className="fi-vender-texto">
              <strong>Vender</strong>
              <small>Escaneá o tocá los productos</small>
            </span>
            <span className="fi-vender-flecha" aria-hidden="true"><IconoFlechaDerecha /></span>
          </Link>
          <Etiqueta tono={pendientes ? 'ambar' : 'verde'} punto>{pendientes ? 'Guardado en este aparato' : 'Todo guardado'}</Etiqueta>
        </div>
      </section>

      <div className="fi-grilla">
        <PrimerosPasos
          negocioId={negocio?.negocioId}
          pasos={pasosDeLaGuia({
            esDueno,
            productos: productos.length,
            ventas: cantidadVentas,
            nombreConfigurado: nombre !== 'Tu almacén',
          })}
        />

        <section className="fi-tareas" aria-labelledby="fi-tareas-titulo">
          <h2 id="fi-tareas-titulo" className="fi-titulo-bloque">Para hacer ahora</h2>
          {tareas.length === 0 ? (
            <p className="fi-tareas-nada"><span className="fi-tarea-icono" data-tono="verde" aria-hidden="true"><IconoConfirmar /></span>Nada pendiente. Está todo en orden.</p>
          ) : (
            <ul className="fi-tareas-lista">
              {tareas.map((tarea) => {
                const Icono = ICONO_TAREA[tarea.id]
                return (
                  <li key={tarea.id} className="fi-tarea" data-tono={tarea.tono}>
                    <span className="fi-tarea-icono" data-tono={tarea.tono} aria-hidden="true"><Icono /></span>
                    <span className="fi-tarea-texto">
                      <strong>{tarea.texto}</strong>
                      <small>{tarea.detalle}</small>
                    </span>
                    <Link href={tarea.href} className="fi-tarea-accion" aria-label={`${tarea.accion}: ${tarea.texto}`}>{tarea.accion}</Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {(esDueno || hayFiados || hayStock) && (
          <section className="fi-numeros" aria-label="Tu día en números">
            {esDueno && (
              <Indicador
                href={bajoCosto.length > 0 ? '/stock' : hayPlata ? '/plata' : undefined}
                icono={bajoCosto.length > 0 ? IconoAlerta : IconoGanancia}
                tono={bajoCosto.length > 0 ? 'ambar' : 'verde'}
                etiqueta={bajoCosto.length > 0 ? 'Ganancia' : 'Ganaste hoy'}
                valor={formatearPesos(resumen.ganancia)}
                nota={bajoCosto.length > 0 ? 'Hay productos vendidos por debajo del costo' : 'Lo que te queda después de pagar la mercadería'}
              />
            )}
            {hayFiados && (
              <Indicador
                href="/fiados"
                icono={IconoFiados}
                tono="coral"
                etiqueta="Te deben"
                valor={formatearPesos(teDeben)}
                nota={vencidos.cantidad > 0
                  ? `${vencidos.cantidad} ${vencidos.cantidad === 1 ? 'vencido' : 'vencidos'}`
                  : teDeben > 0 ? 'Todo al día' : 'Nadie te debe'}
                urgente={vencidos.cantidad > 0}
              />
            )}
            {hayStock && (
              <Indicador
                href="/stock"
                icono={IconoStock}
                tono="ambar"
                etiqueta={productos.length === 0 ? 'Mercadería' : 'Por reponer'}
                valor={productos.length === 0 ? 'Cargá tus productos' : String(reponer.cantidad)}
                valorTexto={productos.length === 0}
                nota={productos.length === 0
                  ? 'Sin esto no hay qué vender'
                  : reponer.cantidad === 0 ? 'Todo en orden' : listaCorta(reponer.nombres)}
                urgente={reponer.cantidad > 0}
              />
            )}
          </section>
        )}

        <Tarjeta como="section" className="fi-horario" aria-labelledby="fi-horario-titulo">
          <div className="fi-bloque-cabeza">
            <span className="fi-bloque-icono" data-tono="verde"><IconoHora /></span>
            <div>
              <h2 id="fi-horario-titulo" className="f-seccion">Ventas de hoy por horario</h2>
              <p className="fi-bloque-ayuda">Pasá el cursor o tocá una barra para ver cuánto vendiste en ese horario.</p>
            </div>
          </div>
          <GraficoHoras franjas={franjas} />
        </Tarjeta>

        {hayPlata && (
          <Tarjeta como="section" className="fi-caja" aria-labelledby="fi-caja-titulo">
            <div className="fi-bloque-cabeza">
              <span className="fi-bloque-icono" data-tono="tinta"><IconoCobrar /></span>
              <div>
                <h2 id="fi-caja-titulo" className="f-seccion">Caja de hoy</h2>
                <p className="fi-bloque-ayuda">Cómo te pagaron lo que vendiste.</p>
              </div>
            </div>
            <FilaMedio icono={IconoEfectivo} nombre="Efectivo" monto={medios.efectivo} ancho={porcentajeDe(medios.efectivo)} tono="verde" />
            <FilaMedio icono={IconoQR} nombre="QR y transferencia" monto={qrYTransferencia} ancho={porcentajeDe(qrYTransferencia)} tono="tinta" />
            <FilaMedio icono={IconoFiados} nombre="Fiado" monto={medios.fiado} ancho={porcentajeDe(medios.fiado)} tono="coral" />
            <Link href="/plata" className="fi-caja-cerrar">
              <span>Cerrar caja</span>
              <IconoFlechaDerecha />
            </Link>
          </Tarjeta>
        )}

        {ultimas.length > 0 && (
          <Tarjeta como="section" className="fi-ultimas" aria-labelledby="fi-ultimas-titulo">
            <div className="fi-bloque-cabeza">
              <span className="fi-bloque-icono" data-tono="tinta"><IconoHistorial /></span>
              <div>
                <h2 id="fi-ultimas-titulo" className="f-seccion">Últimas ventas</h2>
                <p className="fi-bloque-ayuda">Lo último que cobraste.</p>
              </div>
              <Link href="/historial" className="fi-enlace">Ver todas</Link>
            </div>
            <ul className="fi-ultimas-lista">
              {ultimas.map((venta) => {
                const Icono = ICONO_MEDIO[venta.medioPago]
                return (
                  <li key={venta.id} className="fi-venta">
                    <span className="fi-venta-icono" data-tono={venta.medioPago === 'fiado' ? 'coral' : undefined}><Icono /></span>
                    <span className="fi-venta-cuerpo">
                      <span className="fi-venta-titulo">{venta.items.map((item) => (item.cantidad > 1 ? `${item.nombre} ×${item.cantidad}` : item.nombre)).join(', ')}</span>
                      <span className="fi-venta-detalle" data-tono={venta.medioPago === 'fiado' ? 'coral' : undefined}>
                        {HORA.format(new Date(venta.fecha))} · {MEDIO[venta.medioPago]}{venta.medioPago === 'fiado' && nombreCliente(venta.clienteId) ? ` a ${nombreCliente(venta.clienteId)}` : ''}
                      </span>
                    </span>
                    <span className="fi-venta-monto">{formatearPesos(venta.total)}</span>
                  </li>
                )
              })}
            </ul>
          </Tarjeta>
        )}

        {(hayFactura || hayPlata) && (
          <section className="fi-atajos" aria-label="Atajos">
            {hayPlata && (
              <Atajo href="/plata" icono={IconoMasCantidad} titulo="Anotar un gasto" ayuda="Luz, proveedor, alquiler…" />
            )}
            {hayFactura && (
              <Atajo href="/stock" icono={IconoCamara} titulo="Foto de factura" ayuda="Cargá la mercadería con una foto" />
            )}
          </section>
        )}
      </div>
    </div>
  )
}

const ICONO_TAREA: Record<Tarea['id'], ComponentType> = {
  'fiados-vencidos': IconoFiados,
  'fiado-viejo': IconoWhatsApp,
  'bajo-costo': IconoAlerta,
  reponer: IconoStock,
  'sin-productos': IconoStock,
}

type Tono = 'verde' | 'coral' | 'ambar' | 'tinta'

function Indicador({
  href, icono: Icono, tono, etiqueta, valor, valorTexto = false, nota, extra, urgente = false,
}: {
  href?: string
  icono: ComponentType
  tono: Tono
  etiqueta: string
  valor: string
  valorTexto?: boolean
  nota: ReactNode
  extra?: string | null
  urgente?: boolean
}) {
  const contenido = (
    <>
      <span className="fi-indicador-cabeza">
        <span className="fi-indicador-icono"><Icono /></span>
        <span className="fi-indicador-etiqueta">{etiqueta}</span>
        {href && <span className="fi-indicador-ir" aria-hidden="true"><IconoFlechaDerecha /></span>}
      </span>
      <span className={`fi-indicador-valor${valorTexto ? ' fi-indicador-valor-texto' : ''}`}>{valor}</span>
      <span className="fi-indicador-nota" data-urgente={urgente ? 'true' : undefined}>{nota}</span>
      {extra && <span className="fi-indicador-extra">{extra}</span>}
    </>
  )
  return href
    ? <Link href={href} className="fi-indicador" data-tono={tono}>{contenido}</Link>
    : <div className="fi-indicador" data-tono={tono}>{contenido}</div>
}

function Atajo({ href, icono: Icono, titulo, ayuda }: { href: string; icono: ComponentType; titulo: string; ayuda: string }) {
  return (
    <Link href={href} className="fi-atajo">
      <span className="fi-atajo-icono"><Icono /></span>
      <span className="fi-atajo-texto">
        <strong>{titulo}</strong>
        <small>{ayuda}</small>
      </span>
      <span className="fi-atajo-ir" aria-hidden="true"><IconoFlechaDerecha /></span>
    </Link>
  )
}

function FilaMedio({ icono: Icono, nombre, monto, ancho, tono }: { icono: ComponentType; nombre: string; monto: number; ancho: number; tono: 'verde' | 'tinta' | 'coral' }) {
  return (
    <div className="fi-medio" data-tono={tono}>
      <span className="fi-medio-fila">
        <span className="fi-medio-icono"><Icono /></span>
        <span className="fi-medio-nombre">{nombre}{monto > 0 && <small className="fi-medio-pct"> {Math.min(100, ancho)}%</small>}</span>
        <span className="fi-medio-monto">{formatearPesos(monto)}</span>
      </span>
      <span className="fi-medio-barra" aria-hidden="true"><span style={{ width: `${ancho}%` }} /></span>
    </div>
  )
}
