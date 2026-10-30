'use client'

import { Portada } from '@/ui/sistema/Portada'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { repos } from '@/datos/local/repos'
import { formatearPesos } from '@/dominio/dinero'
import { etiquetaVencimiento } from '@/dominio/inteligencia'
import {
  alertasPriorizadas,
  alertasMargenOperacion,
  clientesInactivosOperacion,
  clientesSinTelefonoOperacion,
  clientesTopOperacion,
  cobrosDigitalesSinReferencia,
  compararOperacion,
  coberturaStockOperacion,
  estadoCierreOperacion,
  exportarOperacion,
  horariosRentables,
  integridadOperacion,
  metaOperacion,
  mensajeOperacion,
  mixCobrosOperacion,
  oportunidadesClientesOperacion,
  pedidosAtrasadosOperacion,
  pedidosParaHoyOperacion,
  pronosticoOperacion,
  radarRotacionOperacion,
  recurrenciaClientesOperacion,
  reservasEnRiesgoOperacion,
  riesgoCarteraOperacion,
  ritmoDiario,
  saludCatalogoOperacion,
  scoreOperacion,
  stockComprometidoOperacion,
  sugerenciasReposicionOperacion,
  valorInventarioOperacion,
  vencimientosCarteraOperacion,
  type NivelOperacion,
  type PeriodoOperacion,
} from '@/dominio/operacionPro'
import { resumenPeriodo } from '@/dominio/reportes'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Segmentado } from '@/ui/sistema/Segmentado'
import { Etiqueta, type TonoEtiqueta } from '@/ui/sistema/Etiqueta'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import {
  IconoCerrar,
  IconoConfig,
  IconoDescargar,
  IconoEscanear,
  IconoFlechaDerecha,
  IconoFiados,
  IconoHistorial,
  IconoMovimiento,
  IconoStock,
  IconoWhatsApp,
} from '@/ui/sistema/iconos'
import './pro.css'
import { EstadoVacio } from '@/ui/sistema/EstadoVacio'

const PERIODOS: Array<{ id: PeriodoOperacion; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7dias', label: '7 días' },
  { id: '30dias', label: '30 días' },
]

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'QR',
  fiado: 'Fiado',
}

function fechaCorta(epoch: number | null): string {
  if (!epoch) return 'Sin compras todavía'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date(epoch))
}

function nivelLabel(nivel: NivelOperacion): string {
  if (nivel === 'critico') return 'Urgente'
  if (nivel === 'atencion') return 'Atención'
  if (nivel === 'bien') return 'En orden'
  return 'Para revisar'
}

function periodoLabel(periodo: PeriodoOperacion): string {
  return PERIODOS.find((opcion) => opcion.id === periodo)?.label ?? 'Hoy'
}

function porcentajeBarra(valor: number, maximo: number): number {
  if (maximo <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((valor / maximo) * 100)))
}

type TonoPro = 'good' | 'warning' | 'danger' | 'neutral'

/** Verde = en orden, ámbar = atención, gris = sin más. El coral queda para
 *  lo que se debe (fiados): un margen flojo es atención, no deuda. */
function tonoEtiqueta(tono: TonoPro, deuda: boolean): TonoEtiqueta {
  if (tono === 'good') return 'verde'
  if (tono === 'danger') return deuda ? 'coral' : 'ambar'
  if (tono === 'warning') return 'ambar'
  return 'gris'
}

function ProFeatureCard({
  numero,
  titulo,
  descripcion,
  valor,
  href,
  accion,
  tono = 'neutral',
  deuda = false,
}: {
  numero: string
  titulo: string
  descripcion: string
  valor: string
  href?: string
  accion?: { label: string; onClick: () => void }
  tono?: TonoPro
  deuda?: boolean
}) {
  return (
    <Tarjeta como="article" className="f-pro-funcion">
      <div className="f-pro-funcion-top"><span className="f-dato">{numero}</span><span className="f-etiqueta f-pro-valor" data-tono={tonoEtiqueta(tono, deuda)}>{valor}</span></div>
      <h3 className="f-renglon-texto">{titulo}</h3>
      <p className="f-dato">{descripcion}</p>
      {(href || accion) && <div className="f-pro-funcion-accion">{href && <Link href={href} className="f-pro-enlace">Abrir <IconoFlechaDerecha /></Link>}{accion && <button type="button" className="f-pro-enlace" onClick={accion.onClick}>{accion.label} <IconoFlechaDerecha /></button>}</div>}
    </Tarjeta>
  )
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return <EstadoVacio compacto titulo={titulo} texto={texto} />
}

function Plata({ centavos, className = 'f-plata-16' }: { centavos: number; className?: string }) {
  return <span className={className}>{formatearPesos(centavos)}</span>
}

function Panel({ id, className = '', titulo, detalle, fin, children }: { id?: string; className?: string; titulo: string; detalle: string; fin?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tarjeta como="section" id={id} className={`f-pro-panel ${className}`.trim()} aria-labelledby={`pro-${id ?? titulo}`}>
      <div className="f-pro-panel-cabeza"><div><h2 id={`pro-${id ?? titulo}`} className="f-seccion">{titulo}</h2><p className="f-dato">{detalle}</p></div>{fin}</div>
      {children}
    </Tarjeta>
  )
}

function estadoEtiqueta(estado: string): TonoEtiqueta {
  if (estado === 'estable') return 'verde'
  if (estado === 'critico' || estado === 'vigilar') return 'ambar'
  return 'gris'
}

function nivelEtiqueta(nivel: NivelOperacion): TonoEtiqueta {
  if (nivel === 'bien') return 'verde'
  if (nivel === 'critico' || nivel === 'atencion') return 'ambar'
  return 'gris'
}

export function CentroPro() {
  const [periodo, setPeriodo] = useState<PeriodoOperacion>('7dias')
  const [metaPesos, setMetaPesos] = useState(() => {
    if (typeof window === 'undefined') return '50000'
    return window.localStorage.getItem('libreta:objetivo-pro-pesos') ?? '50000'
  })
  const [aviso, setAviso] = useState<string | null>(null)

  const datos = useLiveQuery(async () => {
    const [ventas, productos, clientes, fiados, pagos, pedidos, movimientos, ultimoCierre, negocio, pendientes] = await Promise.all([
      repos.ventas.todas(),
      repos.productos.todos(),
      repos.clientes.todos(),
      db.fiados.toArray(),
      db.fiadoPagos.toArray(),
      db.pedidos.toArray(),
      db.movimientosCaja.toArray(),
      repos.cierres.ultimo(),
      db.negocio.get('unico'),
      db.cola.count(),
    ])
    return { ventas, productos, clientes, fiados, pagos, pedidos, movimientos, ultimoCierre, negocio, pendientes, ahora: Date.now() }
  }, [], null)

  const objetivoCentavos = Math.max(0, Math.round((Number(metaPesos.replace(',', '.')) || 0) * 100))

  const calculos = useMemo(() => {
    if (!datos) return null
    const { ventas, productos, clientes, fiados, pagos, pedidos, movimientos, ultimoCierre, ahora } = datos
    const resumen = resumenPeriodo(ventas, periodo, ahora)
    const comparativa = compararOperacion(ventas, periodo, ahora)
    const inventario = valorInventarioOperacion(productos)
    const catalogo = saludCatalogoOperacion(productos)
    const pronostico = pronosticoOperacion(ventas, ahora)
    const cobertura = coberturaStockOperacion(productos, ventas, ahora)
    const radar = radarRotacionOperacion(productos, ventas, ahora)
    const reposicion = sugerenciasReposicionOperacion(productos, ventas, ahora)
    const alertasMargen = alertasMargenOperacion(productos)
    const vencimientos = vencimientosCarteraOperacion(fiados, pagos, clientes, ahora)
    const riesgo = riesgoCarteraOperacion(fiados, pagos, clientes, ahora)
    const reservas = reservasEnRiesgoOperacion(pedidos, productos)
    const stockComprometido = stockComprometidoOperacion(pedidos, productos)
    const integridad = integridadOperacion(productos, ventas, fiados, pagos, pedidos)
    return {
      resumen,
      comparativa,
      inventario,
      catalogo,
      pronostico,
      cobertura,
      radar,
      reposicion,
      alertasMargen,
      vencimientos,
      riesgo,
      reservas,
      stockComprometido,
      integridad,
      alertas: alertasPriorizadas(productos, ventas, fiados, pagos, pedidos, ahora),
      horarios: horariosRentables(ventas, periodo, ahora),
      ritmo: ritmoDiario(ventas, 7, ahora),
      mix: mixCobrosOperacion(ventas, periodo, ahora),
      digitalesSinReferencia: cobrosDigitalesSinReferencia(ventas, periodo, ahora),
      cierre: estadoCierreOperacion(ventas, pagos, movimientos, ultimoCierre, ahora),
      pedidosHoy: pedidosParaHoyOperacion(pedidos, clientes, ahora),
      pedidosAtrasados: pedidosAtrasadosOperacion(pedidos, clientes, ahora),
      topClientes: clientesTopOperacion(ventas, clientes),
      inactivos: clientesInactivosOperacion(ventas, clientes, ahora),
      oportunidades: oportunidadesClientesOperacion(ventas, clientes, ahora),
      recurrencia: recurrenciaClientesOperacion(ventas, clientes),
      sinTelefono: clientesSinTelefonoOperacion(clientes, ventas),
      score: scoreOperacion(productos, ventas, fiados, pagos, pedidos, ahora),
    }
  }, [datos, periodo])

  if (!datos || !calculos) return <EstadoCarga texto="Preparando tu Centro Pro…" filas={4} />

  const datosListos = datos
  const calculosListos = calculos
  const meta = metaOperacion(calculos.resumen.vendido, objetivoCentavos)
  const totalAlertas = calculos.alertas.length + calculos.integridad.filter((item) => item.nivel === 'critico').length
  const maxRitmo = Math.max(...calculos.ritmo.map((punto) => punto.vendido), 1)
  const negocio = datos.negocio?.nombre?.trim() || 'Tu almacén'

  function guardarMeta() {
    const valor = Number(metaPesos.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) {
      setAviso('Escribí una meta válida en pesos.')
      return
    }
    window.localStorage.setItem('libreta:objetivo-pro-pesos', String(valor))
    setAviso('Meta diaria guardada en este dispositivo.')
  }

  function compartirResumen() {
    const texto = mensajeOperacion(negocio, calculosListos.comparativa, calculosListos.inventario, totalAlertas, datosListos.ahora)
    window.open(enlaceWhatsApp('', texto), '_blank', 'noopener,noreferrer')
  }

  function descargarInforme() {
    const informe = exportarOperacion({ nombre: negocio }, periodo, datosListos.ventas, datosListos.productos, datosListos.clientes, datosListos.fiados, datosListos.pagos, datosListos.pedidos, datosListos.ahora)
    const archivo = new Blob([JSON.stringify(informe, null, 2)], { type: 'application/json;charset=utf-8' })
    const enlace = URL.createObjectURL(archivo)
    const ancla = document.createElement('a')
    ancla.href = enlace
    ancla.download = `libreta-control-pro-${new Date(datosListos.ahora).toISOString().slice(0, 10)}.json`
    ancla.click()
    URL.revokeObjectURL(enlace)
    setAviso('Informe descargado. Incluye ventas, productos y pedidos del negocio.')
  }

  const features = [
    { numero: '01', titulo: 'Score operativo', descripcion: 'Una lectura rápida de qué tan listo está el negocio para vender.', valor: `${calculos.score}/100`, href: '/plata', tono: calculos.score >= 80 ? 'good' : calculos.score >= 55 ? 'warning' : 'danger' },
    { numero: '02', titulo: 'Alertas priorizadas', descripcion: 'Stock, fiados, reservas y pedidos ordenados por urgencia.', valor: String(totalAlertas), href: '#alertas', tono: totalAlertas === 0 ? 'good' : 'warning' },
    { numero: '03', titulo: 'Comparativa real', descripcion: 'Compará este período con el equivalente anterior.', valor: `${calculos.comparativa.porcentaje >= 0 ? '+' : ''}${calculos.comparativa.porcentaje}%`, href: '#ritmo', tono: calculos.comparativa.porcentaje >= 0 ? 'good' : 'warning' },
    { numero: '04', titulo: 'Horas rentables', descripcion: 'Detectá cuándo conviene reforzar atención y reposición.', valor: calculos.horarios[0]?.etiqueta || '—', href: '#ritmo' },
    { numero: '05', titulo: 'Ritmo diario', descripcion: 'Serie de siete días para ver el pulso del negocio.', valor: `${calculos.resumen.cantidadVentas} ventas`, href: '#ritmo' },
    { numero: '06', titulo: 'Pronóstico de 7 días', descripcion: 'Proyección conservadora con nivel de confianza visible.', valor: formatearPesos(calculos.pronostico.proximoPeriodo), href: '#ritmo' },
    { numero: '07', titulo: 'Meta de venta', descripcion: 'Guardá un objetivo diario y seguí cuánto falta.', valor: `${meta.porcentaje}%`, href: '#meta', tono: meta.cumplido ? 'good' : 'neutral' },
    { numero: '08', titulo: 'Mix de cobros', descripcion: 'Qué medios usan tus clientes y en qué proporción.', valor: calculos.mix[0] ? MEDIOS[calculos.mix[0].medio] : 'Sin datos', href: '#cobros' },
    { numero: '09', titulo: 'Referencias digitales', descripcion: 'Transferencias y QR sin referencia para rastrear.', valor: String(calculos.digitalesSinReferencia.length), href: '/historial', tono: calculos.digitalesSinReferencia.length === 0 ? 'good' : 'warning' },
    { numero: '10', titulo: 'Cierre inteligente', descripcion: 'Calculá el efectivo esperado desde el último arqueo.', valor: formatearPesos(calculos.cierre.esperado), href: '/plata#caja' },
    { numero: '11', titulo: 'Valor de inventario', descripcion: 'Capital inmovilizado a costo y margen potencial.', valor: formatearPesos(calculos.inventario.aCosto), href: '/stock' },
    { numero: '12', titulo: 'Cobertura de stock', descripcion: 'Cuántos días puede durar cada producto.', valor: calculos.cobertura[0]?.diasCobertura === null ? 'Sin rotación' : `${calculos.cobertura[0]?.diasCobertura ?? 0} días`, href: '#stock-pro' },
    { numero: '13', titulo: 'Radar de rotación', descripcion: 'Separá los productos que vuelan de los que duermen.', valor: `${calculos.radar.filter((item) => item.unidadesVendidas > 0).length} activos`, href: '#stock-pro' },
    { numero: '14', titulo: 'Reposición sugerida', descripcion: 'Cantidad orientativa e inversión para los próximos días.', valor: String(calculos.reposicion.length), href: '#stock-pro', tono: calculos.reposicion.length === 0 ? 'good' : 'warning' },
    { numero: '15', titulo: 'Guardia de margen', descripcion: 'Precios que venden debajo del costo o del margen mínimo.', valor: String(calculos.alertasMargen.length), href: '/stock', tono: calculos.alertasMargen.length === 0 ? 'good' : 'danger' },
    { numero: '16', titulo: 'Salud del catálogo', descripcion: 'Completitud de códigos, costos, precios y stock.', valor: `${calculos.catalogo.porcentajeCompleto}%`, href: '/stock', tono: calculos.catalogo.porcentajeCompleto >= 90 ? 'good' : 'warning' },
    { numero: '17', titulo: 'Riesgo de reservas', descripcion: 'Pedidos que pueden prometer más unidades de las disponibles.', valor: String(calculos.reservas.length), href: '/pedidos', tono: calculos.reservas.length === 0 ? 'good' : 'danger' },
    { numero: '18', titulo: 'Clientes principales', descripcion: 'Quién más compra y cuánto aporta a la caja.', valor: calculos.topClientes[0]?.cliente.nombre || 'Sin datos', href: '/clientes' },
    { numero: '19', titulo: 'Clientes inactivos', descripcion: 'Personas que dejaron de comprar y merecen un mensaje.', valor: String(calculos.inactivos.length), href: '#clientes-pro' },
    { numero: '20', titulo: 'Recurrencia', descripcion: 'Qué parte de tu cartera ya volvió a comprar.', valor: `${calculos.recurrencia.porcentaje}%`, href: '#clientes-pro' },
    { numero: '21', titulo: 'Oportunidades', descripcion: 'Compradores de una vez o con señales de regreso.', valor: String(calculos.oportunidades.length), href: '#clientes-pro' },
    { numero: '22', titulo: 'Riesgo de cartera', descripcion: 'Saldo, antigüedad y uso del límite por cliente.', valor: String(calculos.riesgo.filter((item) => item.riesgo === 'alto').length), href: '/fiados', deuda: true, tono: calculos.riesgo.some((item) => item.riesgo === 'alto') ? 'danger' : 'good' },
    { numero: '23', titulo: 'Vencimientos', descripcion: 'Fiados vencidos y próximos a vencer, sin perder fechas.', valor: String(calculos.vencimientos.filter((item) => item.estado === 'vencido' || item.estado === 'pronto').length), href: '/fiados', deuda: true, tono: calculos.vencimientos.some((item) => item.estado === 'vencido') ? 'danger' : 'neutral' },
    { numero: '24', titulo: 'Fichas incompletas', descripcion: 'Clientes con compras pero sin teléfono para contactar.', valor: String(calculos.sinTelefono.length), href: '/clientes' },
    { numero: '25', titulo: 'Pedidos para hoy', descripcion: 'Agenda de entregas que pide atención durante el día.', valor: String(calculos.pedidosHoy.length), href: '/pedidos' },
    { numero: '26', titulo: 'Pedidos atrasados', descripcion: 'Entregas pasadas que siguen abiertas.', valor: String(calculos.pedidosAtrasados.length), href: '/pedidos', tono: calculos.pedidosAtrasados.length === 0 ? 'good' : 'danger' },
    { numero: '27', titulo: 'Stock comprometido', descripcion: 'Unidades y pesos bloqueados por reservas activas.', valor: `${calculos.stockComprometido.unidades} u.`, href: '/pedidos' },
    { numero: '28', titulo: 'Control de integridad', descripcion: 'Detector de duplicados, negativos y relaciones rotas.', valor: calculos.integridad[0]?.nivel === 'bien' ? 'OK' : String(calculos.integridad.length), href: '#integridad', tono: calculos.integridad.some((item) => item.nivel === 'critico') ? 'danger' : 'good' },
    { numero: '29', titulo: 'Informe portable', descripcion: 'Descargá una foto operativa completa del negocio.', valor: 'JSON', accion: { label: 'Descargar', onClick: descargarInforme } },
    { numero: '30', titulo: 'Resumen compartible', descripcion: 'Mandá el estado del negocio por WhatsApp en un toque.', valor: 'WhatsApp', accion: { label: 'Compartir', onClick: compartirResumen } },
  ] as const


  return (
    <div className="page-pro f-pro">
      <Portada
        id="pro"
        titulo="Centro Pro"
        subtitulo="Treinta herramientas para decidir más rápido, cuidar tu margen y no perder ventas."
        rotulo="Salud de tu negocio"
        valor={calculos.score}
        formato="numero"
        sufijo="/100"
        tono={calculos.score >= 80 ? 'lima' : calculos.score >= 55 ? 'ambar' : 'coral'}
        detalle={<p>{calculos.score >= 80 ? 'Todo en orden' : calculos.score >= 55 ? 'Hay cosas para mirar' : 'Necesita atención'}</p>}
        accion={(
          <>
            <Boton variante="secundario" onClick={compartirResumen}><IconoWhatsApp /> Compartir resumen</Boton>
            <Boton variante="secundario" onClick={descargarInforme}><IconoDescargar /> Descargar informe</Boton>
          </>
        )}
      />

      <div className="f-pro-periodo">
        <div><span className="f-dato">Ventana de análisis</span><strong className="f-seccion">{periodoLabel(periodo)}</strong></div>
        <Segmentado
          etiqueta="Período de análisis"
          className="f-pro-periodos"
          valor={periodo}
          onCambiar={setPeriodo}
          opciones={PERIODOS.map((opcion) => ({ valor: opcion.id, texto: opcion.label }))}
        />
      </div>

      {aviso && <div className="f-aviso f-pro-aviso f-pro-ok" role="status"><span>{aviso}</span><button type="button" className="f-icono-boton" onClick={() => setAviso(null)} aria-label="Cerrar aviso"><IconoCerrar /></button></div>}

      <section className="f-pro-indice" aria-labelledby="pro-feature-title">
        <div>
          <h2 id="pro-feature-title" className="f-seccion">30 nuevas funciones activas</h2>
          <p className="f-dato">Todo está conectado con las secciones que ya usás. Abrí una tarjeta para resolverlo desde el lugar correcto.</p>
        </div>
        <div className="f-pro-funciones">{features.map((feature) => <ProFeatureCard key={feature.numero} {...feature} />)}</div>
      </section>

      <div className="f-pro-paneles">
        <Panel id="alertas" titulo="Lo que pide acción" detalle="Una sola bandeja para no dejar problemas escondidos." fin={<Etiqueta tono={totalAlertas > 0 ? 'ambar' : 'verde'}>{totalAlertas}</Etiqueta>}>
          {calculos.alertas.length === 0
            ? <div className="f-pro-bien"><strong>Todo tranquilo por acá</strong><span className="f-dato">No hay alertas urgentes en este momento.</span></div>
            : <div className="f-pro-lista">{calculos.alertas.map((alerta) => (
              <div className="f-renglon" key={alerta.id}>
                <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{alerta.titulo}</span><span className="f-renglon-detalle">{alerta.detalle}</span></span>
                <Etiqueta tono={alerta.nivel === 'bien' ? 'verde' : 'ambar'}>{alerta.cantidad}</Etiqueta>
                <Link href={alerta.ruta} className="f-icono-boton" aria-label={`Resolver ${alerta.titulo}`}><IconoFlechaDerecha /></Link>
              </div>
            ))}</div>}
        </Panel>

        <Panel id="meta" titulo="Tu objetivo de hoy" detalle="Guardalo en este aparato y usalo como norte.">
          <div className="f-pro-meta"><strong className="f-plata-36">{formatearPesos(calculos.resumen.vendido)}</strong><span className="f-dato">de {formatearPesos(objetivoCentavos)}</span></div>
          <div className="f-pro-barra" role="progressbar" aria-label="Avance de la meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meta.porcentaje}><span style={{ width: `${meta.porcentaje}%` }} /></div>
          <div className="f-pro-pie"><span className="f-dato">{meta.cumplido ? 'Meta cumplida' : `Faltan ${formatearPesos(meta.restante)}`}</span><strong className="f-plata-16">{meta.porcentaje}%</strong></div>
          <form className="f-pro-meta-form" onSubmit={(evento) => { evento.preventDefault(); guardarMeta() }}>
            <label className="f-campo"><span>Meta diaria en pesos</span><input className="f-entrada" inputMode="decimal" value={metaPesos} onChange={(evento) => setMetaPesos(evento.target.value)} aria-label="Meta diaria en pesos" /></label>
            <Boton type="submit" variante="secundario">Guardar meta</Boton>
          </form>
        </Panel>

        <Panel id="ritmo" titulo="Ritmo y horas fuertes" detalle={calculos.comparativa.porcentaje >= 0 ? 'Vas por encima del período comparable.' : 'El período comparable venía más fuerte.'} fin={<Etiqueta tono={calculos.comparativa.porcentaje >= 0 ? 'verde' : 'ambar'}>{calculos.comparativa.porcentaje >= 0 ? '+' : ''}{calculos.comparativa.porcentaje}%</Etiqueta>}>
          <div className="f-pro-barras" role="img" aria-label="Ventas de los últimos siete días">{calculos.ritmo.map((punto) => (
            <div className="f-pro-columna" key={punto.fecha}>
              <span className="f-pro-columna-valor">{punto.vendido > 0 ? formatearPesos(punto.vendido) : '—'}</span>
              <span className="f-pro-columna-pista"><i style={{ height: `${porcentajeBarra(punto.vendido, maxRitmo)}%` }} /></span>
              <small>{punto.etiqueta}</small>
            </div>
          ))}</div>
          {calculos.horarios.length > 0 && <div className="f-pro-destacado"><span className="f-dato">Mejor hora</span><strong className="f-seccion">{calculos.horarios[0].etiqueta}</strong><span className="f-dato">{formatearPesos(calculos.horarios[0].vendido)} vendidos · {calculos.horarios[0].ventas} ventas</span></div>}
        </Panel>

        <Panel id="cobros" titulo="Cómo entró la plata" detalle="Distribución del período seleccionado.">
          {calculos.mix.length === 0 ? <Vacio titulo="Todavía no hay cobros en este período" texto="Cuando cobres, vas a ver cómo te pagaron." /> : <div className="f-pro-lista">{calculos.mix.map((medio) => (
            <div key={medio.medio} className="f-pro-cobro">
              <div className="f-renglon-cuerpo"><span className="f-renglon-titulo">{MEDIOS[medio.medio]}</span><span className="f-renglon-detalle">{medio.ventas} {medio.ventas === 1 ? 'venta' : 'ventas'}</span></div>
              <div className="f-pro-cobro-monto"><span className="f-dato">{medio.porcentaje}%</span><Plata centavos={medio.monto} /></div>
              <span className="f-pro-barra f-pro-barra-fina"><span style={{ width: `${medio.porcentaje}%` }} /></span>
            </div>
          ))}</div>}
          {calculos.digitalesSinReferencia.length > 0 && <Link href="/historial" className="f-aviso f-pro-enlace-aviso" data-tono="ambar"><span>{calculos.digitalesSinReferencia.length} cobros digitales sin referencia</span><IconoFlechaDerecha /></Link>}
        </Panel>

        <Panel id="stock-pro" titulo="Radar de stock" detalle="Lo que se agota, lo que rota y lo que inmoviliza plata.">
          <div className="f-pro-datos">
            <div><span className="f-dato">Inventario a costo</span><strong className="f-plata-16">{formatearPesos(calculos.inventario.aCosto)}</strong></div>
            <div><span className="f-dato">Margen potencial</span><strong className="f-plata-16">{formatearPesos(calculos.inventario.margenPotencial)}</strong></div>
            <div><span className="f-dato">Para reponer</span><strong className="f-plata-16">{calculos.reposicion.length}</strong></div>
          </div>
          <div className="f-pro-lista">{calculos.radar.slice(0, 5).map((item) => (
            <div className="f-renglon" key={item.producto.id}>
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{item.producto.nombre}</span><span className="f-renglon-detalle">{item.unidadesVendidas} u. en 14 días · {item.diasCobertura === null ? 'sin rotación' : `${item.diasCobertura} días de cobertura`}</span></span>
              <Etiqueta tono={estadoEtiqueta(item.estado)}>{item.estado === 'agotado' ? 'Agotado' : item.estado === 'critico' ? 'Crítico' : item.estado === 'vigilar' ? 'Vigilar' : item.estado === 'sin-rotacion' ? 'Dormido' : 'Estable'}</Etiqueta>
            </div>
          ))}{calculos.radar.length === 0 && <Vacio titulo="Todavía no hay productos para vigilar" texto="Cargá tus productos para ver qué se te termina." />}</div>
          <Link href="/stock" className="f-pro-enlace">Abrir stock completo <IconoFlechaDerecha /></Link>
        </Panel>

        <Panel id="clientes-pro" titulo="Clientes que mueven el negocio" detalle="Premiá la recurrencia y recuperá a quien se alejó.">
          <div className="f-pro-datos">
            <div><span className="f-dato">Recurrencia</span><strong className="f-plata-16">{calculos.recurrencia.porcentaje}%</strong><small className="f-dato">{calculos.recurrencia.recurrentes} volvieron</small></div>
            <div><span className="f-dato">Oportunidades</span><strong className="f-plata-16">{calculos.oportunidades.length}</strong><small className="f-dato">para contactar</small></div>
            <div><span className="f-dato">Sin teléfono</span><strong className="f-plata-16">{calculos.sinTelefono.length}</strong><small className="f-dato">fichas incompletas</small></div>
          </div>
          <div className="f-pro-lista">{calculos.topClientes.slice(0, 4).map((cliente, indice) => (
            <div className="f-renglon" key={cliente.cliente.id}>
              <span className="f-pro-rango" aria-hidden="true">{indice + 1}</span>
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{cliente.cliente.nombre}</span><span className="f-renglon-detalle">{cliente.ventas} compras · última {fechaCorta(cliente.ultimaCompra)}</span></span>
              <Plata centavos={cliente.gastado} />
            </div>
          ))}{calculos.topClientes.length === 0 && <Vacio titulo="Todavía no hay ranking de clientes" texto="Cuando vendas a un cliente, va a aparecer acá." />}</div>
          <div className="f-pro-destacado f-pro-destacado-fila"><span><strong className="f-renglon-texto">{calculos.inactivos.length} clientes para reactivar</strong><span className="f-dato"> Usá la cartera para volver a abrir la conversación.</span></span><Link href="/clientes" className="f-pro-enlace">Ver cartera <IconoFlechaDerecha /></Link></div>
        </Panel>

        <Panel id="credito" titulo="Riesgo y vencimientos" detalle="Priorizá a quién escribir antes de que la deuda se enfríe.">
          <div className="f-pro-datos">
            <div><span className="f-dato">Saldo abierto</span><strong className="f-plata-16">{formatearPesos(calculos.vencimientos.reduce((total, item) => total + item.saldo, 0))}</strong></div>
            <div><span className="f-dato">Riesgo alto</span><strong className="f-plata-16">{calculos.riesgo.filter((item) => item.riesgo === 'alto').length}</strong></div>
            <div><span className="f-dato">Próximos</span><strong className="f-plata-16">{calculos.vencimientos.filter((item) => item.estado === 'pronto').length}</strong></div>
          </div>
          <div className="f-pro-lista">{calculos.vencimientos.slice(0, 4).map((item) => (
            <div className="f-renglon" key={item.fiado.id}>
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{item.cliente?.nombre || 'Cliente sin ficha'}</span><span className="f-renglon-detalle">{item.dias === null ? 'Sin fecha' : etiquetaVencimiento(item.fiado.vence, datos.ahora)}</span></span>
              <Etiqueta tono={item.estado === 'vencido' ? 'coral' : item.estado === 'pronto' ? 'ambar' : 'gris'}>{formatearPesos(item.saldo)}</Etiqueta>
            </div>
          ))}{calculos.vencimientos.length === 0 && <Vacio titulo="No te debe nadie" texto="Cuando anotes un fiado, lo seguís desde acá." />}</div>
          <Link href="/fiados" className="f-pro-enlace">Abrir fiados <IconoFlechaDerecha /></Link>
        </Panel>

        <Panel id="agenda" titulo="Pedidos en movimiento" detalle="Lo urgente arriba, sin perder reservas.">
          <div className="f-pro-datos">
            <div><span className="f-dato">Para hoy</span><strong className="f-plata-16">{calculos.pedidosHoy.length}</strong></div>
            <div><span className="f-dato">Atrasados</span><strong className="f-plata-16">{calculos.pedidosAtrasados.length}</strong></div>
            <div><span className="f-dato">Stock reservado</span><strong className="f-plata-16">{calculos.stockComprometido.unidades} u.</strong></div>
          </div>
          <div className="f-pro-lista">{[...calculos.pedidosAtrasados, ...calculos.pedidosHoy].slice(0, 4).map((item) => (
            <div className="f-renglon" key={item.pedido.id}>
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">Pedido #{item.pedido.id.slice(0, 6)}</span><span className="f-renglon-detalle">{item.cliente?.nombre || 'Sin cliente'} · {item.dias === null ? 'Sin fecha' : item.dias === 0 ? 'Hoy' : `Hace ${item.dias} días`}</span></span>
              <Plata centavos={item.valor} />
            </div>
          ))}{calculos.pedidosHoy.length === 0 && calculos.pedidosAtrasados.length === 0 && <Vacio titulo="No tenés pedidos para hoy" texto="Los pedidos que anotes aparecen en esta agenda." />}</div>
          <Link href="/pedidos" className="f-pro-enlace">Abrir pedidos <IconoFlechaDerecha /></Link>
        </Panel>

        <Panel id="integridad" titulo="Control de integridad" detalle="Una revisión antes de compartir o cerrar el día.">
          <div className="f-pro-lista">{calculos.integridad.map((item) => (
            <div className="f-renglon" key={`${item.titulo}-${item.cantidad}`}>
              <span className="f-pro-rango" data-tono={nivelEtiqueta(item.nivel)} aria-hidden="true">{item.nivel === 'bien' ? '✓' : item.cantidad}</span>
              <span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{item.titulo}</span><span className="f-renglon-detalle">{item.detalle}</span></span>
              <Etiqueta tono={nivelEtiqueta(item.nivel)}>{nivelLabel(item.nivel)}</Etiqueta>
            </div>
          ))}</div>
          <div className="f-pro-destacado f-pro-destacado-fila"><span className="f-dato">{nubeActiva() ? `${datos.pendientes} cambios esperan conexión para enviarse.` : 'Modo local: todo queda guardado en este aparato.'}</span><Link href="/config" className="f-pro-enlace">Revisar <IconoFlechaDerecha /></Link></div>
        </Panel>
      </div>

      <section className="f-pro-atajos" aria-labelledby="pro-atajos-titulo">
        <div><h2 id="pro-atajos-titulo" className="f-seccion">Resolver en dos toques</h2><p className="f-dato">Las acciones más usadas, siempre a mano.</p></div>
        <div className="f-pro-atajos-grilla">
          <Link href="/vender" className="f-pro-atajo f-boton-principal"><IconoEscanear /><span><strong>Nueva venta</strong><small>Escanear o buscar</small></span><IconoFlechaDerecha /></Link>
          <Link href="/stock" className="f-pro-atajo"><IconoStock /><span><strong>Cargar stock</strong><small>Producto o factura</small></span><IconoFlechaDerecha /></Link>
          <Link href="/fiados" className="f-pro-atajo"><IconoFiados /><span><strong>Cobrar fiados</strong><small>Ver vencimientos</small></span><IconoFlechaDerecha /></Link>
          <Link href="/plata" className="f-pro-atajo"><IconoMovimiento /><span><strong>Revisar caja</strong><small>Ver movimientos</small></span><IconoFlechaDerecha /></Link>
          <Link href="/historial" className="f-pro-atajo"><IconoHistorial /><span><strong>Auditar ventas</strong><small>Buscar comprobantes</small></span><IconoFlechaDerecha /></Link>
          <Link href="/config" className="f-pro-atajo"><IconoConfig /><span><strong>Configurar</strong><small>Preferencias y backup</small></span><IconoFlechaDerecha /></Link>
        </div>
      </section>
    </div>
  )
}
