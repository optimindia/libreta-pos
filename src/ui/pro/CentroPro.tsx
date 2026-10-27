'use client'

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
import { Importe } from '@/ui/sistema/Importe'
import { CargandoPagina } from '@/ui/sistema/CargandoPagina'
import {
  IconoAlerta,
  IconoClientes,
  IconoCobrar,
  IconoConfig,
  IconoCuenta,
  IconoDescargar,
  IconoEscanear,
  IconoFlechaDerecha,
  IconoFiados,
  IconoHistorial,
  IconoMovimiento,
  IconoNube,
  IconoPedidos,
  IconoPlata,
  IconoPorcentaje,
  IconoReintentar,
  IconoStock,
  IconoWhatsApp,
} from '@/ui/sistema/iconos'

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

function ProFeatureCard({
  numero,
  titulo,
  descripcion,
  valor,
  href,
  accion,
  tono = 'neutral',
}: {
  numero: string
  titulo: string
  descripcion: string
  valor: string
  href?: string
  accion?: { label: string; onClick: () => void }
  tono?: 'good' | 'warning' | 'danger' | 'neutral'
}) {
  return (
    <article className={`pro-feature-card is-${tono}`}>
      <div className="pro-feature-card-top"><span className="pro-feature-number">{numero}</span><span className="pro-feature-value">{valor}</span></div>
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
      {(href || accion) && <div className="pro-feature-action">{href && <Link href={href}>Abrir <IconoFlechaDerecha /></Link>}{accion && <button type="button" onClick={accion.onClick}>{accion.label} <IconoFlechaDerecha /></button>}</div>}
    </article>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="pro-empty-copy">{texto}</p>
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

  if (!datos || !calculos) return <CargandoPagina texto="Preparando tu Centro Pro…" />

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
    { numero: '22', titulo: 'Riesgo de cartera', descripcion: 'Saldo, antigüedad y uso del límite por cliente.', valor: String(calculos.riesgo.filter((item) => item.riesgo === 'alto').length), href: '/fiados', tono: calculos.riesgo.some((item) => item.riesgo === 'alto') ? 'danger' : 'good' },
    { numero: '23', titulo: 'Vencimientos', descripcion: 'Fiados vencidos y próximos a vencer, sin perder fechas.', valor: String(calculos.vencimientos.filter((item) => item.estado === 'vencido' || item.estado === 'pronto').length), href: '/fiados', tono: calculos.vencimientos.some((item) => item.estado === 'vencido') ? 'danger' : 'neutral' },
    { numero: '24', titulo: 'Fichas incompletas', descripcion: 'Clientes con compras pero sin teléfono para contactar.', valor: String(calculos.sinTelefono.length), href: '/clientes' },
    { numero: '25', titulo: 'Pedidos para hoy', descripcion: 'Agenda de entregas que pide atención durante el día.', valor: String(calculos.pedidosHoy.length), href: '/pedidos' },
    { numero: '26', titulo: 'Pedidos atrasados', descripcion: 'Entregas pasadas que siguen abiertas.', valor: String(calculos.pedidosAtrasados.length), href: '/pedidos', tono: calculos.pedidosAtrasados.length === 0 ? 'good' : 'danger' },
    { numero: '27', titulo: 'Stock comprometido', descripcion: 'Unidades y pesos bloqueados por reservas activas.', valor: `${calculos.stockComprometido.unidades} u.`, href: '/pedidos' },
    { numero: '28', titulo: 'Control de integridad', descripcion: 'Detector de duplicados, negativos y relaciones rotas.', valor: calculos.integridad[0]?.nivel === 'bien' ? 'OK' : String(calculos.integridad.length), href: '#integridad', tono: calculos.integridad.some((item) => item.nivel === 'critico') ? 'danger' : 'good' },
    { numero: '29', titulo: 'Informe portable', descripcion: 'Descargá una foto operativa completa del negocio.', valor: 'JSON', accion: { label: 'Descargar', onClick: descargarInforme } },
    { numero: '30', titulo: 'Resumen compartible', descripcion: 'Mandá el estado del negocio por WhatsApp en un toque.', valor: 'WhatsApp', accion: { label: 'Compartir', onClick: compartirResumen } },
  ] as const

  return (
    <div className="page-pro">
      <header className="pro-head">
        <div className="pro-head-copy"><span className="page-kicker">Inteligencia para tu negocio</span><h1>Centro Pro</h1><p>Treinta herramientas para decidir más rápido, cuidar tu margen y no perder ventas.</p></div>
        <div className={`pro-score pro-score-${calculos.score >= 80 ? 'good' : calculos.score >= 55 ? 'warning' : 'danger'}`}><span>Salud operativa</span><strong>{calculos.score}<small>/100</small></strong><em>{calculos.score >= 80 ? 'Todo en orden' : calculos.score >= 55 ? 'Hay cosas para mirar' : 'Necesita atención'}</em></div>
        <div className="pro-head-actions"><button type="button" onClick={compartirResumen}><IconoWhatsApp /> Compartir resumen</button><button type="button" onClick={descargarInforme}><IconoDescargar /> Descargar informe</button></div>
      </header>

      <div className="pro-toolbar">
        <div><span className="pro-toolbar-kicker">Ventana de análisis</span><strong>{periodoLabel(periodo)}</strong><small>Las métricas se recalculan con tus datos locales.</small></div>
        <div className="pro-periods" role="group" aria-label="Período de análisis">{PERIODOS.map((opcion) => <button key={opcion.id} type="button" className={periodo === opcion.id ? 'is-selected' : ''} aria-pressed={periodo === opcion.id} onClick={() => setPeriodo(opcion.id)}>{opcion.label}</button>)}</div>
      </div>

      {aviso && <div className="pro-toast" role="status"><IconoReintentar /><span>{aviso}</span><button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button></div>}

      <section className="pro-feature-index" aria-labelledby="pro-feature-title">
        <div className="pro-section-heading"><div><span className="page-kicker">Mapa de capacidades</span><h2 id="pro-feature-title">30 nuevas funciones activas</h2><p>Todo está conectado con las secciones que ya usás. Abrí una tarjeta para resolverlo desde el lugar correcto.</p></div><span className="pro-section-count">30 <small>herramientas</small></span></div>
        <div className="pro-feature-grid">{features.map((feature) => <ProFeatureCard key={feature.numero} {...feature} />)}</div>
      </section>

      <div className="pro-dashboard-grid">
        <section id="alertas" className="pro-panel pro-panel-alerts">
          <div className="pro-panel-heading"><div><span className="page-kicker">Atención inmediata</span><h2>Lo que pide acción</h2><p>Una sola bandeja para no dejar problemas escondidos.</p></div><span className={`pro-count-badge${totalAlertas > 0 ? ' is-warning' : ' is-good'}`}>{totalAlertas}</span></div>
          {calculos.alertas.length === 0 ? <div className="pro-good-state"><IconoReintentar /><strong>Todo tranquilo por acá</strong><span>No hay alertas urgentes en este momento.</span></div> : <div className="pro-alert-list">{calculos.alertas.map((alerta) => <div className={`pro-alert-row is-${alerta.nivel}`} key={alerta.id}><span className="pro-alert-icon"><IconoAlerta /></span><div><strong>{alerta.titulo}</strong><p>{alerta.detalle}</p></div><span className="pro-alert-count">{alerta.cantidad}</span><Link href={alerta.ruta} aria-label={`Resolver ${alerta.titulo}`}><IconoFlechaDerecha /></Link></div>)}</div>}
        </section>

        <section id="meta" className="pro-panel pro-panel-goal">
          <div className="pro-panel-heading"><div><span className="page-kicker">Ritmo de venta</span><h2>Tu objetivo de hoy</h2><p>Guardalo en este aparato y usalo como norte.</p></div><span className="pro-goal-icon"><IconoPorcentaje /></span></div>
          <div className="pro-goal-value"><Importe centavos={calculos.resumen.vendido} tamaño="grande" /><span>de <Importe centavos={objetivoCentavos} tamaño="chico" /></span></div>
          <div className="pro-progress-track"><span style={{ width: `${meta.porcentaje}%` }} /></div><div className="pro-goal-foot"><span>{meta.cumplido ? 'Meta cumplida' : `Faltan ${formatearPesos(meta.restante)}`}</span><strong>{meta.porcentaje}%</strong></div>
          <form className="pro-goal-form" onSubmit={(evento) => { evento.preventDefault(); guardarMeta() }}><label><span>Meta diaria en pesos</span><input inputMode="decimal" value={metaPesos} onChange={(evento) => setMetaPesos(evento.target.value)} aria-label="Meta diaria en pesos" /></label><button type="submit">Guardar meta</button></form>
        </section>

        <section id="ritmo" className="pro-panel pro-panel-trend">
          <div className="pro-panel-heading"><div><span className="page-kicker">Lectura comercial</span><h2>Ritmo y horas fuertes</h2><p>{calculos.comparativa.porcentaje >= 0 ? 'Vas por encima del período comparable.' : 'El período comparable venía más fuerte.'}</p></div><span className={`pro-delta ${calculos.comparativa.porcentaje >= 0 ? 'is-positive' : 'is-negative'}`}>{calculos.comparativa.porcentaje >= 0 ? '+' : ''}{calculos.comparativa.porcentaje}%</span></div>
          <div className="pro-bars" aria-label="Ventas de los últimos siete días">{calculos.ritmo.map((punto) => <div className="pro-bar-column" key={punto.fecha}><span className="pro-bar-value">{punto.vendido > 0 ? formatearPesos(punto.vendido) : '—'}</span><span className="pro-bar-track"><i style={{ height: `${porcentajeBarra(punto.vendido, maxRitmo)}%` }} /></span><small>{punto.etiqueta}</small></div>)}</div>
          {calculos.horarios.length > 0 && <div className="pro-best-hour"><span><IconoPlata /> Mejor hora</span><strong>{calculos.horarios[0].etiqueta}</strong><small>{formatearPesos(calculos.horarios[0].vendido)} vendidos · {calculos.horarios[0].ventas} ventas</small></div>}
        </section>

        <section id="cobros" className="pro-panel pro-panel-payments">
          <div className="pro-panel-heading"><div><span className="page-kicker">Cobros</span><h2>Cómo entró la plata</h2><p>Distribución del período seleccionado.</p></div><span className="pro-panel-icon"><IconoCobrar /></span></div>
          {calculos.mix.length === 0 ? <Vacio texto="Todavía no hay cobros en este período." /> : <div className="pro-payment-list">{calculos.mix.map((medio) => <div key={medio.medio} className="pro-payment-row"><div><strong>{MEDIOS[medio.medio]}</strong><small>{medio.ventas} {medio.ventas === 1 ? 'venta' : 'ventas'}</small></div><div className="pro-payment-amount"><span>{medio.porcentaje}%</span><Importe centavos={medio.monto} tamaño="chico" /></div><span className="pro-mini-progress"><i style={{ width: `${medio.porcentaje}%` }} /></span></div>)}</div>}
          {calculos.digitalesSinReferencia.length > 0 && <Link href="/historial" className="pro-inline-warning"><IconoAlerta /> {calculos.digitalesSinReferencia.length} cobros digitales sin referencia <IconoFlechaDerecha /></Link>}
        </section>

        <section id="stock-pro" className="pro-panel pro-panel-stock">
          <div className="pro-panel-heading"><div><span className="page-kicker">Inventario inteligente</span><h2>Radar de stock</h2><p>Lo que se agota, lo que rota y lo que inmoviliza plata.</p></div><span className="pro-panel-icon"><IconoStock /></span></div>
          <div className="pro-stock-summary"><div><span>Inventario a costo</span><strong>{formatearPesos(calculos.inventario.aCosto)}</strong></div><div><span>Margen potencial</span><strong>{formatearPesos(calculos.inventario.margenPotencial)}</strong></div><div><span>Para reponer</span><strong>{calculos.reposicion.length}</strong></div></div>
          <div className="pro-list">{calculos.radar.slice(0, 5).map((item) => <div className="pro-list-row" key={item.producto.id}><div><strong>{item.producto.nombre}</strong><small>{item.unidadesVendidas} u. en 14 días · {item.diasCobertura === null ? 'sin rotación' : `${item.diasCobertura} días de cobertura`}</small></div><span className={`pro-status-dot is-${item.estado}`}>{item.estado === 'agotado' ? 'Agotado' : item.estado === 'critico' ? 'Crítico' : item.estado === 'vigilar' ? 'Vigilar' : item.estado === 'sin-rotacion' ? 'Dormido' : 'Estable'}</span></div>)}{calculos.radar.length === 0 && <Vacio texto="Cargá productos para activar el radar." />}</div>
          <Link href="/stock" className="pro-panel-link">Abrir stock completo <IconoFlechaDerecha /></Link>
        </section>

        <section id="clientes-pro" className="pro-panel pro-panel-clients">
          <div className="pro-panel-heading"><div><span className="page-kicker">Relación comercial</span><h2>Clientes que mueven el negocio</h2><p>Premiá la recurrencia y recuperá a quien se alejó.</p></div><span className="pro-panel-icon"><IconoClientes /></span></div>
          <div className="pro-client-metrics"><div><span>Recurrencia</span><strong>{calculos.recurrencia.porcentaje}%</strong><small>{calculos.recurrencia.recurrentes} clientes volvieron</small></div><div><span>Oportunidades</span><strong>{calculos.oportunidades.length}</strong><small>para contactar</small></div><div><span>Sin teléfono</span><strong>{calculos.sinTelefono.length}</strong><small>fichas incompletas</small></div></div>
          <div className="pro-list">{calculos.topClientes.slice(0, 4).map((cliente, indice) => <div className="pro-list-row" key={cliente.cliente.id}><span className="pro-rank">{indice + 1}</span><div><strong>{cliente.cliente.nombre}</strong><small>{cliente.ventas} compras · última {fechaCorta(cliente.ultimaCompra)}</small></div><Importe centavos={cliente.gastado} tamaño="chico" /></div>)}{calculos.topClientes.length === 0 && <Vacio texto="Vinculá una venta a un cliente para construir tu ranking." />}</div>
          <div className="pro-client-callout"><IconoWhatsApp /><span><strong>{calculos.inactivos.length} clientes para reactivar</strong><small>Usá la cartera para volver a abrir la conversación.</small></span><Link href="/clientes">Ver cartera <IconoFlechaDerecha /></Link></div>
        </section>

        <section className="pro-panel pro-panel-credit">
          <div className="pro-panel-heading"><div><span className="page-kicker">Fiado bajo control</span><h2>Riesgo y vencimientos</h2><p>Priorizá a quién escribir antes de que la deuda se enfríe.</p></div><span className="pro-panel-icon"><IconoFiados /></span></div>
          <div className="pro-credit-summary"><div><span>Saldo abierto</span><strong>{formatearPesos(calculos.vencimientos.reduce((total, item) => total + item.saldo, 0))}</strong></div><div><span>Riesgo alto</span><strong>{calculos.riesgo.filter((item) => item.riesgo === 'alto').length}</strong></div><div><span>Próximos</span><strong>{calculos.vencimientos.filter((item) => item.estado === 'pronto').length}</strong></div></div>
          <div className="pro-list">{calculos.vencimientos.slice(0, 4).map((item) => <div className="pro-list-row" key={item.fiado.id}><div><strong>{item.cliente?.nombre || 'Cliente sin ficha'}</strong><small>{item.dias === null ? 'Sin fecha' : etiquetaVencimiento(item.fiado.vence, datos.ahora)}</small></div><span className={`pro-status-dot is-${item.estado}`}>{formatearPesos(item.saldo)}</span></div>)}{calculos.vencimientos.length === 0 && <Vacio texto="No hay deuda abierta para seguir." />}</div>
          <Link href="/fiados" className="pro-panel-link">Abrir fiados <IconoFlechaDerecha /></Link>
        </section>

        <section className="pro-panel pro-panel-agenda">
          <div className="pro-panel-heading"><div><span className="page-kicker">Agenda de entregas</span><h2>Pedidos en movimiento</h2><p>Lo urgente arriba, sin perder reservas.</p></div><span className="pro-panel-icon"><IconoPedidos /></span></div>
          <div className="pro-agenda-summary"><div className="is-today"><span>Para hoy</span><strong>{calculos.pedidosHoy.length}</strong></div><div className="is-late"><span>Atrasados</span><strong>{calculos.pedidosAtrasados.length}</strong></div><div><span>Stock reservado</span><strong>{calculos.stockComprometido.unidades} u.</strong></div></div>
          <div className="pro-list">{[...calculos.pedidosAtrasados, ...calculos.pedidosHoy].slice(0, 4).map((item) => <div className="pro-list-row" key={item.pedido.id}><div><strong>Pedido #{item.pedido.id.slice(0, 6)}</strong><small>{item.cliente?.nombre || 'Sin cliente'} · {item.dias === null ? 'Sin fecha' : item.dias === 0 ? 'Hoy' : `Hace ${item.dias} días`}</small></div><Importe centavos={item.valor} tamaño="chico" /></div>)}{calculos.pedidosHoy.length === 0 && calculos.pedidosAtrasados.length === 0 && <Vacio texto="La agenda está limpia por ahora." />}</div>
          <Link href="/pedidos" className="pro-panel-link">Abrir pedidos <IconoFlechaDerecha /></Link>
        </section>

        <section id="integridad" className="pro-panel pro-panel-integrity">
          <div className="pro-panel-heading"><div><span className="page-kicker">Confianza en los datos</span><h2>Control de integridad</h2><p>Una revisión antes de compartir o cerrar el día.</p></div><span className="pro-panel-icon"><IconoCuenta /></span></div>
          <div className="pro-integrity-list">{calculos.integridad.map((item) => <div className={`pro-integrity-row is-${item.nivel}`} key={`${item.titulo}-${item.cantidad}`}><span>{item.nivel === 'bien' ? '✓' : item.cantidad}</span><div><strong>{item.titulo}</strong><small>{item.detalle}</small></div><em>{nivelLabel(item.nivel)}</em></div>)}</div>
          <div className="pro-integrity-footer"><IconoNube /><span>{nubeActiva() ? `${datos.pendientes} operaciones esperando sincronización.` : 'Modo local: todo queda guardado en este aparato.'}</span><Link href="/config">Revisar <IconoFlechaDerecha /></Link></div>
        </section>
      </div>

      <section className="pro-quick-actions">
        <div><span className="page-kicker">Atajos de operación</span><h2>Resolver en dos toques</h2><p>Las acciones más usadas, siempre a mano.</p></div>
        <div className="pro-quick-grid"><Link href="/" className="is-primary"><IconoEscanear /><span><strong>Nueva venta</strong><small>Escanear o buscar</small></span><IconoFlechaDerecha /></Link><Link href="/stock"><IconoStock /><span><strong>Cargar stock</strong><small>Producto o factura</small></span><IconoFlechaDerecha /></Link><Link href="/fiados"><IconoFiados /><span><strong>Cobrar fiados</strong><small>Ver vencimientos</small></span><IconoFlechaDerecha /></Link><Link href="/plata"><IconoMovimiento /><span><strong>Revisar caja</strong><small>Ver movimientos</small></span><IconoFlechaDerecha /></Link><Link href="/historial"><IconoHistorial /><span><strong>Auditar ventas</strong><small>Buscar comprobantes</small></span><IconoFlechaDerecha /></Link><Link href="/config"><IconoConfig /><span><strong>Configurar</strong><small>Preferencias y backup</small></span><IconoFlechaDerecha /></Link></div>
      </section>
    </div>
  )
}
