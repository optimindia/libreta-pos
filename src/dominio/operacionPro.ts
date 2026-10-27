import type {
  Centavos,
  Cierre,
  Cliente,
  Fiado,
  FiadoPago,
  MovimientoCaja,
  Pedido,
  Producto,
  UUID,
  Venta,
} from './tipos'
import { formatearPesos, multiplicar, sumar } from './dinero'
import { gananciaVenta } from './ganancia'
import { deudaPorCliente, saldoFiado } from './fiado'
import { movimientosEfectivo, esperadoEnCaja } from './caja'
import { listaDeCompra, type SugerenciaCompra } from './reposicion'
import {
  clientesValiosos,
  diasParaVencer,
  margenProducto,
  progresoObjetivo,
  pronosticoVentas,
  riesgoFiado,
  rotacionStock,
  type RiesgoFiado,
} from './inteligencia'
import { filtrarVentas, rangoReporte, type PeriodoReporte } from './reportes'

const DIA_EN_MS = 24 * 60 * 60 * 1000

export type PeriodoOperacion = Extract<PeriodoReporte, 'hoy' | '7dias' | '30dias'>
export type NivelOperacion = 'critico' | 'atencion' | 'bien' | 'info'

export interface RangoOperacion {
  desde: number
  hasta: number
}

export interface ComparativaOperacion {
  actual: Centavos
  anterior: Centavos
  diferencia: Centavos
  porcentaje: number
  ventasActuales: number
  ventasAnteriores: number
}

export interface HorarioOperacion {
  hora: number
  etiqueta: string
  ventas: number
  vendido: Centavos
  ganancia: Centavos
}

export interface RitmoDiario {
  fecha: number
  etiqueta: string
  vendido: Centavos
  ganancia: Centavos
  ventas: number
}

export interface PronosticoOperacion {
  promedioDiario: Centavos
  proximoPeriodo: Centavos
  confianza: 'baja' | 'media' | 'alta'
  ventasObservadas: number
}

export interface MedioOperacion {
  medio: Venta['medioPago']
  ventas: number
  monto: Centavos
  porcentaje: number
}

export interface CierreOperacion {
  hayVentasPendientes: boolean
  desde: number
  efectivoVentas: Centavos
  efectivoFiados: Centavos
  entradas: Centavos
  salidas: Centavos
  esperado: Centavos
  ultimoCierre: Cierre | null
}

export interface ValorInventarioOperacion {
  unidades: number
  aCosto: Centavos
  aPrecio: Centavos
  margenPotencial: Centavos
}

export interface CoberturaOperacion {
  producto: Producto
  unidadesVendidas: number
  diasCobertura: number | null
  estado: 'agotado' | 'critico' | 'vigilar' | 'estable' | 'sin-rotacion'
}

export interface MargenOperacion {
  producto: Producto
  margen: number
  perdidaPorUnidad: Centavos
}

export interface SaludCatalogoOperacion {
  total: number
  completos: number
  sinCodigo: number
  sinCosto: number
  sinPrecio: number
  debajoDelCosto: number
  sinStock: number
  porcentajeCompleto: number
}

export interface RiesgoReservaOperacion {
  pedidoId: UUID
  productoId: UUID
  producto: string
  reservado: number
  stock: number
  disponibleDespuesDeReservas: number
  nivel: 'critico' | 'atencion'
}

export interface ClienteOperacion {
  cliente: Cliente
  ventas: number
  gastado: Centavos
  ultimaCompra: number | null
  diasSinComprar: number | null
  recurrencia: number
  ticketPromedio: Centavos
}

export interface RiesgoCarteraOperacion {
  cliente: Cliente
  saldo: Centavos
  diasMasViejo: number
  riesgo: RiesgoFiado
  porcentajeLimite: number | null
}

export interface VencimientoOperacion {
  fiado: Fiado
  cliente: Cliente | null
  saldo: Centavos
  dias: number | null
  estado: 'vencido' | 'pronto' | 'futuro' | 'sin-fecha'
}

export interface PedidoOperacion {
  pedido: Pedido
  dias: number | null
  cliente: Cliente | null
  valor: Centavos
}

export interface IntegridadOperacion {
  nivel: NivelOperacion
  titulo: string
  detalle: string
  cantidad: number
}

export interface AlertaOperacion {
  id: string
  nivel: NivelOperacion
  titulo: string
  detalle: string
  cantidad: number
  ruta: string
}

function inicioDelDia(epoch: number): number {
  const fecha = new Date(epoch)
  fecha.setHours(0, 0, 0, 0)
  return fecha.getTime()
}

function claveDia(epoch: number): string {
  const fecha = new Date(epoch)
  return `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${fecha.getDate()}`
}

function textoHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`
}

function ventasDelRango(ventas: Venta[], rango: RangoOperacion): Venta[] {
  return filtrarVentas(ventas, rango)
}

/** Helper compartido: quita anulaciones antes de calcular una decisión. */
export function ventasVigentes(ventas: Venta[]): Venta[] {
  return ventas.filter((venta) => venta.estado !== 'anulada')
}

/** 1. Score operativo explicable: mide si el negocio está listo para vender. */
export function scoreOperacion(
  productos: Producto[],
  ventas: Venta[],
  fiados: Fiado[],
  pagos: FiadoPago[],
  pedidos: Pedido[],
  ahora: number = Date.now(),
): number {
  let score = 100
  const catalogo = saludCatalogoOperacion(productos)
  const vencidos = vencimientosCarteraOperacion(fiados, pagos, [], ahora).filter((item) => item.estado === 'vencido').length
  const atrasados = pedidosAtrasadosOperacion(pedidos, [], ahora).length
  const criticos = productos.filter((producto) => producto.stock <= 0 || producto.precio <= 0 || producto.precio < producto.costo).length
  if (productos.length === 0) score -= 25
  else score -= Math.min(15, Math.round((1 - catalogo.porcentajeCompleto / 100) * 15))
  score -= Math.min(20, criticos * 4)
  score -= Math.min(20, vencidos * 5)
  score -= Math.min(15, atrasados * 5)
  if (ventasVigentes(ventas).length === 0) score -= 5
  return Math.max(0, Math.min(100, score))
}

/** 2. Bandeja única de alertas priorizadas, con destino para resolverlas. */
export function alertasPriorizadas(
  productos: Producto[],
  ventas: Venta[],
  fiados: Fiado[],
  pagos: FiadoPago[],
  pedidos: Pedido[],
  ahora: number = Date.now(),
): AlertaOperacion[] {
  const alertas: AlertaOperacion[] = []
  const agotados = productos.filter((producto) => producto.stock <= 0).length
  const margen = alertasMargenOperacion(productos).length
  const vencidos = vencimientosCarteraOperacion(fiados, pagos, [], ahora).filter((item) => item.estado === 'vencido').length
  const atrasados = pedidosAtrasadosOperacion(pedidos, [], ahora).length
  const reservas = reservasEnRiesgoOperacion(pedidos, productos).filter((item) => item.nivel === 'critico').length
  const sinReferencia = cobrosDigitalesSinReferencia(ventas, 'todo', ahora).length
  if (agotados > 0) alertas.push({ id: 'stock-agotado', nivel: 'critico', titulo: 'Productos agotados', detalle: 'Cargá mercadería o pausá la venta para no prometer de más.', cantidad: agotados, ruta: '/stock' })
  if (vencidos > 0) alertas.push({ id: 'fiado-vencido', nivel: 'critico', titulo: 'Fiados vencidos', detalle: 'Contactá a quienes tienen saldo fuera de fecha.', cantidad: vencidos, ruta: '/fiados' })
  if (reservas > 0) alertas.push({ id: 'reserva-riesgo', nivel: 'critico', titulo: 'Reservas comprometidas', detalle: 'Hay pedidos que prometen más stock del disponible.', cantidad: reservas, ruta: '/pedidos' })
  if (atrasados > 0) alertas.push({ id: 'pedido-atrasado', nivel: 'atencion', titulo: 'Pedidos atrasados', detalle: 'Revisá la entrega y avisá al cliente.', cantidad: atrasados, ruta: '/pedidos' })
  if (margen > 0) alertas.push({ id: 'margen-revisar', nivel: 'atencion', titulo: 'Márgenes para revisar', detalle: 'Algunos precios están debajo del objetivo o del costo.', cantidad: margen, ruta: '/stock' })
  if (sinReferencia > 0) alertas.push({ id: 'cobro-sin-referencia', nivel: 'info', titulo: 'Cobros digitales sin referencia', detalle: 'Agregá el comprobante para poder rastrearlos.', cantidad: sinReferencia, ruta: '/historial' })
  return alertas
}

/** Rango comparable interno: hoy contra el mismo día de la semana anterior y
 * los períodos largos contra la ventana inmediatamente anterior. */
export function rangoAnteriorOperacion(
  periodo: PeriodoOperacion,
  ahora: number = Date.now(),
): { actual: RangoOperacion; anterior: RangoOperacion } {
  const actual = rangoReporte(periodo, ahora)
  const duracion = periodo === 'hoy' ? 7 * DIA_EN_MS : (periodo === '7dias' ? 7 : 30) * DIA_EN_MS
  if (periodo === 'hoy') {
    const dia = inicioDelDia(ahora)
    return {
      actual: { desde: dia, hasta: ahora },
      anterior: { desde: dia - duracion, hasta: dia - duracion + (ahora - dia) },
    }
  }
  return {
    actual,
    anterior: { desde: actual.desde - duracion, hasta: actual.hasta - duracion },
  }
}

/** 3. Compara facturación y cantidad de ventas con el período equivalente. */
export function compararOperacion(
  ventas: Venta[],
  periodo: PeriodoOperacion,
  ahora: number = Date.now(),
): ComparativaOperacion {
  const rangos = rangoAnteriorOperacion(periodo, ahora)
  const actuales = ventasDelRango(ventas, rangos.actual)
  const anteriores = ventasDelRango(ventas, rangos.anterior)
  const actual = sumar(...actuales.map((venta) => venta.total))
  const anterior = sumar(...anteriores.map((venta) => venta.total))
  return {
    actual,
    anterior,
    diferencia: actual - anterior,
    porcentaje: anterior === 0 ? (actual > 0 ? 100 : 0) : Math.round(((actual - anterior) / anterior) * 100),
    ventasActuales: actuales.length,
    ventasAnteriores: anteriores.length,
  }
}

/** 4. Descubre las horas que más facturan para ordenar la operación. */
export function horariosRentables(
  ventas: Venta[],
  periodo: PeriodoOperacion,
  ahora: number = Date.now(),
): HorarioOperacion[] {
  const horas = new Map<number, HorarioOperacion>()
  for (const venta of ventasDelRango(ventas, rangoReporte(periodo, ahora))) {
    const hora = new Date(venta.fecha).getHours()
    const actual = horas.get(hora) ?? { hora, etiqueta: textoHora(hora), ventas: 0, vendido: 0, ganancia: 0 }
    actual.ventas += 1
    actual.vendido += venta.total
    actual.ganancia += gananciaVenta(venta)
    horas.set(hora, actual)
  }
  return [...horas.values()].sort((a, b) => b.vendido - a.vendido)
}

/** 5. Serie diaria para detectar ritmo, días flojos y días fuertes. */
export function ritmoDiario(
  ventas: Venta[],
  dias: number = 7,
  ahora: number = Date.now(),
): RitmoDiario[] {
  const cantidad = Math.max(1, Math.floor(dias))
  const hoy = inicioDelDia(ahora)
  const puntos = new Map<string, RitmoDiario>()
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = hoy - indice * DIA_EN_MS
    const date = new Date(fecha)
    puntos.set(claveDia(fecha), {
      fecha,
      etiqueta: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      vendido: 0,
      ganancia: 0,
      ventas: 0,
    })
  }
  for (const venta of ventasVigentes(ventas)) {
    const punto = puntos.get(claveDia(venta.fecha))
    if (!punto) continue
    punto.vendido += venta.total
    punto.ganancia += gananciaVenta(venta)
    punto.ventas += 1
  }
  return [...puntos.values()]
}

/** 6. Proyección conservadora de los próximos siete días. */
export function pronosticoOperacion(
  ventas: Venta[],
  ahora: number = Date.now(),
): PronosticoOperacion {
  const pronostico = pronosticoVentas(ventas, ahora, 14, 7)
  return {
    promedioDiario: pronostico.promedioDiario,
    proximoPeriodo: pronostico.proyectado,
    confianza: pronostico.confianza,
    ventasObservadas: pronostico.ventasEnVentana,
  }
}

/** 7. Estado de una meta de venta que el usuario puede elegir desde la UI. */
export function metaOperacion(vendido: Centavos, objetivo: Centavos) {
  return progresoObjetivo(vendido, objetivo)
}

/** 8. Distribución por medios, con monto, cantidad y porcentaje. */
export function mixCobrosOperacion(
  ventas: Venta[],
  periodo: PeriodoOperacion,
  ahora: number = Date.now(),
): MedioOperacion[] {
  const porMedio = new Map<Venta['medioPago'], MedioOperacion>()
  const delPeriodo = ventasDelRango(ventas, rangoReporte(periodo, ahora))
  const total = sumar(...delPeriodo.map((venta) => venta.total))
  for (const venta of delPeriodo) {
    const actual = porMedio.get(venta.medioPago) ?? { medio: venta.medioPago, ventas: 0, monto: 0, porcentaje: 0 }
    actual.ventas += 1
    actual.monto += venta.total
    porMedio.set(venta.medioPago, actual)
  }
  return [...porMedio.values()]
    .map((medio) => ({ ...medio, porcentaje: total > 0 ? Math.round((medio.monto / total) * 100) : 0 }))
    .sort((a, b) => b.monto - a.monto)
}

/** 9. Detecta cobros electrónicos registrados sin referencia para revisarlos. */
export function cobrosDigitalesSinReferencia(
  ventas: Venta[],
  periodo: PeriodoOperacion | 'todo' = 'todo',
  ahora: number = Date.now(),
): Venta[] {
  const rango = periodo === 'todo' ? { desde: 0, hasta: ahora } : rangoReporte(periodo, ahora)
  return ventasDelRango(ventas, rango).filter((venta) =>
    (venta.medioPago === 'transferencia' || venta.medioPago === 'qr') && !venta.referenciaPago,
  )
}

/** 10. Lista de cierre: qué debería haber en efectivo desde el último arqueo. */
export function estadoCierreOperacion(
  ventas: Venta[],
  pagos: FiadoPago[],
  movimientos: MovimientoCaja[],
  ultimoCierre: Cierre | null,
  ahora: number = Date.now(),
): CierreOperacion {
  const desde = ultimoCierre?.fecha ?? 0
  const efectivo = movimientosEfectivo(ventas, pagos, desde, ahora, movimientos)
  return {
    hayVentasPendientes: ventas.some((venta) => venta.estado !== 'anulada' && venta.fecha > desde && venta.fecha <= ahora),
    desde,
    efectivoVentas: efectivo.ventasEfectivo,
    efectivoFiados: efectivo.pagosFiadoEfectivo,
    entradas: efectivo.entradasCaja ?? 0,
    salidas: efectivo.salidasCaja ?? 0,
    esperado: esperadoEnCaja(ultimoCierre?.fondoInicial ?? 0, efectivo),
    ultimoCierre,
  }
}

/** 11. Valor inmovilizado del inventario a costo, a venta y margen potencial. */
export function valorInventarioOperacion(productos: Producto[]): ValorInventarioOperacion {
  const positivos = productos.filter((producto) => producto.stock > 0)
  const aCosto = sumar(...positivos.map((producto) => multiplicar(producto.costo, producto.stock)))
  const aPrecio = sumar(...positivos.map((producto) => multiplicar(producto.precio, producto.stock)))
  return {
    unidades: positivos.reduce((total, producto) => total + producto.stock, 0),
    aCosto,
    aPrecio,
    margenPotencial: aPrecio - aCosto,
  }
}

/** 12. Cobertura estimada de cada producto en días. */
export function coberturaStockOperacion(
  productos: Producto[],
  ventas: Venta[],
  ahora: number = Date.now(),
): CoberturaOperacion[] {
  return productos.map((producto) => {
    const rotacion = rotacionStock(producto, ventas, ahora)
    const estado: CoberturaOperacion['estado'] = producto.stock <= 0
      ? 'agotado'
      : rotacion.diasCobertura === null
        ? 'sin-rotacion'
        : rotacion.diasCobertura <= 2
          ? 'critico'
          : rotacion.diasCobertura <= 7
            ? 'vigilar'
            : 'estable'
    return { producto, unidadesVendidas: rotacion.unidadesVendidas, diasCobertura: rotacion.diasCobertura, estado }
  }).sort((a, b) => {
    const prioridad: Record<CoberturaOperacion['estado'], number> = {
      agotado: 0,
      critico: 1,
      vigilar: 2,
      estable: 3,
      'sin-rotacion': 4,
    }
    return prioridad[a.estado] - prioridad[b.estado] || (a.diasCobertura ?? 9999) - (b.diasCobertura ?? 9999)
  })
}

/** 13. Radar de rotación: separa lo que se mueve de lo que duerme. */
export function radarRotacionOperacion(
  productos: Producto[],
  ventas: Venta[],
  ahora: number = Date.now(),
): CoberturaOperacion[] {
  return coberturaStockOperacion(productos, ventas, ahora)
    .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)
}

/** 14. Reposición con inversión estimada, lista para decidir y compartir. */
export function sugerenciasReposicionOperacion(
  productos: Producto[],
  ventas: Venta[],
  ahora: number = Date.now(),
): Array<SugerenciaCompra & { inversion: Centavos }> {
  return listaDeCompra(productos, ventas, ahora).map((sugerencia) => ({
    ...sugerencia,
    inversion: multiplicar(sugerencia.producto.costo, sugerencia.cantidadSugerida),
  }))
}

/** 15. Productos que necesitan revisión de margen antes de seguir vendiendo. */
export function alertasMargenOperacion(
  productos: Producto[],
  margenMinimo: number = 20,
): MargenOperacion[] {
  return productos
    .map((producto) => ({
      producto,
      margen: margenProducto(producto),
      perdidaPorUnidad: Math.max(0, producto.costo - producto.precio),
    }))
    .filter((resultado) => resultado.margen < margenMinimo || resultado.producto.precio < resultado.producto.costo)
    .sort((a, b) => a.margen - b.margen)
}

/** 16. Auditoría de calidad del catálogo en una sola lectura. */
export function saludCatalogoOperacion(productos: Producto[]): SaludCatalogoOperacion {
  const total = productos.length
  const sinCodigo = productos.filter((producto) => !producto.codigoBarras?.trim()).length
  const sinCosto = productos.filter((producto) => producto.costo <= 0).length
  const sinPrecio = productos.filter((producto) => producto.precio <= 0).length
  const debajoDelCosto = productos.filter((producto) => producto.precio > 0 && producto.precio < producto.costo).length
  const sinStock = productos.filter((producto) => producto.stock <= 0).length
  const completos = productos.filter((producto) => producto.nombre.trim().length >= 2 && Boolean(producto.codigoBarras?.trim()) && producto.costo > 0 && producto.precio > 0 && producto.precio >= producto.costo).length
  return {
    total,
    completos,
    sinCodigo,
    sinCosto,
    sinPrecio,
    debajoDelCosto,
    sinStock,
    porcentajeCompleto: total === 0 ? 0 : Math.round((completos / total) * 100),
  }
}

/** 17. Detecta pedidos que, juntos, prometen más unidades de las disponibles. */
export function reservasEnRiesgoOperacion(
  pedidos: Pedido[],
  productos: Producto[],
): RiesgoReservaOperacion[] {
  const activos = pedidos.filter((pedido) => pedido.reservarStock && ['pendiente', 'preparando', 'listo'].includes(pedido.estado))
  const porProducto = new Map<UUID, number>()
  for (const pedido of activos) for (const item of pedido.items) porProducto.set(item.productoId, (porProducto.get(item.productoId) ?? 0) + item.cantidad)
  const porId = new Map(productos.map((producto) => [producto.id, producto]))
  const resultado: RiesgoReservaOperacion[] = []
  for (const pedido of activos) {
    for (const item of pedido.items) {
      const producto = porId.get(item.productoId)
      const stock = producto?.stock ?? 0
      const reservado = porProducto.get(item.productoId) ?? 0
      const disponibleDespuesDeReservas = stock - reservado
      if (disponibleDespuesDeReservas <= 1) resultado.push({
        pedidoId: pedido.id,
        productoId: item.productoId,
        producto: item.nombre,
        reservado,
        stock,
        disponibleDespuesDeReservas,
        nivel: disponibleDespuesDeReservas < 0 ? 'critico' : 'atencion',
      })
    }
  }
  return resultado
}

/** 18. Clientes que más aportaron, con una salida lista para llamar. */
export function clientesTopOperacion(ventas: Venta[], clientes: Cliente[]): ClienteOperacion[] {
  return clientesValiosos(ventasVigentes(ventas), clientes).map((cliente) => ({
    cliente: clientes.find((item) => item.id === cliente.clienteId) ?? { id: cliente.clienteId, nombre: cliente.nombre, telefono: cliente.telefono },
    ventas: cliente.ventas,
    gastado: cliente.gastado,
    ultimaCompra: cliente.ultimoCompra || null,
    diasSinComprar: null,
    recurrencia: cliente.ventas,
    ticketPromedio: cliente.ticketPromedio,
  }))
}

/** 19. Cartera que dejó de comprar: clientes con potencial de reactivación. */
export function clientesInactivosOperacion(
  ventas: Venta[],
  clientes: Cliente[],
  ahora: number = Date.now(),
  diasUmbral: number = 30,
): ClienteOperacion[] {
  const porCliente = new Map<UUID, ClienteOperacion>()
  for (const cliente of clientes) porCliente.set(cliente.id, { cliente, ventas: 0, gastado: 0, ultimaCompra: null, diasSinComprar: null, recurrencia: 0, ticketPromedio: 0 })
  for (const venta of ventasVigentes(ventas)) {
    if (!venta.clienteId) continue
    const actual = porCliente.get(venta.clienteId)
    if (!actual) continue
    actual.ventas += 1
    actual.gastado += venta.total
    actual.ultimaCompra = Math.max(actual.ultimaCompra ?? 0, venta.fecha)
  }
  return [...porCliente.values()]
    .map((cliente) => ({
      ...cliente,
      diasSinComprar: cliente.ultimaCompra === null ? null : Math.floor((ahora - cliente.ultimaCompra) / DIA_EN_MS),
      recurrencia: cliente.ventas,
      ticketPromedio: cliente.ventas > 0 ? Math.round(cliente.gastado / cliente.ventas) : 0,
    }))
    .filter((cliente) => cliente.ultimaCompra === null || (cliente.diasSinComprar ?? 0) >= diasUmbral)
    .sort((a, b) => b.gastado - a.gastado)
}

/** 20. Mide recurrencia por cliente y cuántos ya compraron más de una vez. */
export function recurrenciaClientesOperacion(ventas: Venta[], clientes: Cliente[]): { clientesConCompras: number; recurrentes: number; porcentaje: number } {
  const cantidades = new Map<UUID, number>()
  for (const venta of ventasVigentes(ventas)) if (venta.clienteId) cantidades.set(venta.clienteId, (cantidades.get(venta.clienteId) ?? 0) + 1)
  const clientesConCompras = clientes.filter((cliente) => (cantidades.get(cliente.id) ?? 0) > 0).length
  const recurrentes = clientes.filter((cliente) => (cantidades.get(cliente.id) ?? 0) > 1).length
  return { clientesConCompras, recurrentes, porcentaje: clientesConCompras === 0 ? 0 : Math.round((recurrentes / clientesConCompras) * 100) }
}

/** 21. Señala compradores de una sola vez y compradores recientes para una acción comercial. */
export function oportunidadesClientesOperacion(
  ventas: Venta[],
  clientes: Cliente[],
  ahora: number = Date.now(),
): ClienteOperacion[] {
  const recientes = clientesInactivosOperacion(ventas, clientes, ahora, 0)
  return recientes.filter((cliente) => cliente.ventas === 1 || (cliente.diasSinComprar !== null && cliente.diasSinComprar >= 21))
}

/** 22. Semáforo de riesgo de la cartera de fiado. */
export function riesgoCarteraOperacion(
  fiados: Fiado[],
  pagos: FiadoPago[],
  clientes: Cliente[],
  ahora: number = Date.now(),
): RiesgoCarteraOperacion[] {
  return deudaPorCliente(fiados, pagos, ahora).map((deuda) => {
    const cliente = clientes.find((item) => item.id === deuda.clienteId) ?? { id: deuda.clienteId, nombre: 'Cliente sin ficha', telefono: null }
    return {
      cliente,
      saldo: deuda.saldo,
      diasMasViejo: deuda.diasDelMasViejo,
      riesgo: riesgoFiado(deuda.saldo, cliente.limiteFiado, deuda.diasDelMasViejo),
      porcentajeLimite: cliente.limiteFiado && cliente.limiteFiado > 0 ? Math.round((deuda.saldo / cliente.limiteFiado) * 100) : null,
    }
  })
}

/** 23. Vencimientos próximos, vencidos y sin fecha, ordenados por urgencia. */
export function vencimientosCarteraOperacion(
  fiados: Fiado[],
  pagos: FiadoPago[],
  clientes: Cliente[],
  ahora: number = Date.now(),
): VencimientoOperacion[] {
  return fiados
    .map((fiado) => {
      const saldo = saldoFiado(fiado, pagos)
      const dias = diasParaVencer(fiado.vence, ahora)
      const estado: VencimientoOperacion['estado'] = dias === null ? 'sin-fecha' : dias < 0 ? 'vencido' : dias <= 3 ? 'pronto' : 'futuro'
      return { fiado, cliente: clientes.find((cliente) => cliente.id === fiado.clienteId) ?? null, saldo, dias, estado }
    })
    .filter((item) => item.saldo > 0)
    .sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999))
}

/** 24. Descubre fichas sin teléfono para que WhatsApp no falle cuando más se necesita. */
export function clientesSinTelefonoOperacion(clientes: Cliente[], ventas: Venta[]): Cliente[] {
  const conCompra = new Set(ventasVigentes(ventas).map((venta) => venta.clienteId).filter((id): id is UUID => Boolean(id)))
  return clientes.filter((cliente) => !cliente.telefono?.trim() && conCompra.has(cliente.id))
}

function hoyLocal(ahora: number): { desde: number; hasta: number } {
  const desde = inicioDelDia(ahora)
  return { desde, hasta: desde + DIA_EN_MS }
}

/** 25. Pedidos activos que requieren atención durante el día actual. */
export function pedidosParaHoyOperacion(pedidos: Pedido[], clientes: Cliente[], ahora: number = Date.now()): PedidoOperacion[] {
  const hoy = hoyLocal(ahora)
  return pedidos
    .filter((pedido) => pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && pedido.fechaEntrega !== null && pedido.fechaEntrega >= hoy.desde && pedido.fechaEntrega < hoy.hasta)
    .map((pedido) => ({ pedido, dias: 0, cliente: clientes.find((cliente) => cliente.id === pedido.clienteId) ?? null, valor: pedido.total }))
}

/** 26. Pedidos con entrega pasada que siguen abiertos. */
export function pedidosAtrasadosOperacion(pedidos: Pedido[], clientes: Cliente[], ahora: number = Date.now()): PedidoOperacion[] {
  const hoy = inicioDelDia(ahora)
  return pedidos
    .filter((pedido) => pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && pedido.fechaEntrega !== null && pedido.fechaEntrega < hoy)
    .map((pedido) => ({ pedido, dias: Math.floor((hoy - (pedido.fechaEntrega ?? hoy)) / DIA_EN_MS), cliente: clientes.find((cliente) => cliente.id === pedido.clienteId) ?? null, valor: pedido.total }))
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
}

/** 27. Cantidad y valor del stock comprometido por reservas activas. */
export function stockComprometidoOperacion(pedidos: Pedido[], productos: Producto[]): { unidades: number; valor: Centavos; productos: number } {
  const porId = new Map(productos.map((producto) => [producto.id, producto]))
  const unidadesPorProducto = new Map<UUID, number>()
  for (const pedido of pedidos.filter((item) => item.reservarStock && ['pendiente', 'preparando', 'listo'].includes(item.estado))) {
    for (const item of pedido.items) unidadesPorProducto.set(item.productoId, (unidadesPorProducto.get(item.productoId) ?? 0) + item.cantidad)
  }
  let valor = 0
  let unidades = 0
  for (const [productoId, cantidad] of unidadesPorProducto) {
    unidades += cantidad
    valor += multiplicar(porId.get(productoId)?.precio ?? 0, cantidad)
  }
  return { unidades, valor, productos: unidadesPorProducto.size }
}

/** 28. Detector de datos inconsistentes antes de exportar o cerrar el día. */
export function integridadOperacion(
  productos: Producto[],
  ventas: Venta[],
  fiados: Fiado[],
  pagos: FiadoPago[],
  pedidos: Pedido[],
): IntegridadOperacion[] {
  const problemas: IntegridadOperacion[] = []
  const nombres = new Set<string>()
  const codigos = new Set<string>()
  let nombresDuplicados = 0
  let codigosDuplicados = 0
  for (const producto of productos) {
    const nombre = producto.nombre.trim().toLowerCase()
    if (nombres.has(nombre)) nombresDuplicados += 1
    nombres.add(nombre)
    const codigo = producto.codigoBarras?.trim()
    if (codigo && codigos.has(codigo)) codigosDuplicados += 1
    if (codigo) codigos.add(codigo)
  }
  const stockNegativo = productos.filter((producto) => producto.stock < 0).length
  const ventasSinCliente = ventasVigentes(ventas).filter((venta) => venta.medioPago === 'fiado' && !venta.clienteId).length
  const pedidosSinItems = pedidos.filter((pedido) => pedido.items.length === 0).length
  const pagosExcedidos = fiados.filter((fiado) => pagos.filter((pago) => pago.fiadoId === fiado.id).reduce((total, pago) => total + pago.monto, 0) > fiado.monto).length
  if (nombresDuplicados > 0) problemas.push({ nivel: 'critico', titulo: 'Nombres de producto duplicados', detalle: 'Dos productos con el mismo nombre pueden confundirse al cobrar.', cantidad: nombresDuplicados })
  if (codigosDuplicados > 0) problemas.push({ nivel: 'critico', titulo: 'Códigos de barras repetidos', detalle: 'Un lector podría sumar el producto equivocado.', cantidad: codigosDuplicados })
  if (stockNegativo > 0) problemas.push({ nivel: 'critico', titulo: 'Stock negativo', detalle: 'Hay existencias por debajo de cero que necesitan ajuste.', cantidad: stockNegativo })
  if (ventasSinCliente > 0) problemas.push({ nivel: 'atencion', titulo: 'Fiados sin cliente', detalle: 'Hay ventas a cuenta que no se pueden cobrar desde una ficha.', cantidad: ventasSinCliente })
  if (pedidosSinItems > 0) problemas.push({ nivel: 'atencion', titulo: 'Pedidos vacíos', detalle: 'Hay reservas sin productos que conviene revisar.', cantidad: pedidosSinItems })
  if (pagosExcedidos > 0) problemas.push({ nivel: 'info', titulo: 'Pagos excedidos', detalle: 'Hay pagos importados que superan el monto original del fiado.', cantidad: pagosExcedidos })
  if (problemas.length === 0) problemas.push({ nivel: 'bien', titulo: 'Datos consistentes', detalle: 'No encontramos inconsistencias operativas en este dispositivo.', cantidad: 0 })
  return problemas
}

/** 29. Empaqueta un informe portátil para guardar, enviar o auditar. */
export function exportarOperacion(
  negocio: { nombre: string },
  periodo: PeriodoOperacion,
  ventas: Venta[],
  productos: Producto[],
  clientes: Cliente[],
  fiados: Fiado[],
  pagos: FiadoPago[],
  pedidos: Pedido[],
  ahora: number = Date.now(),
): Record<string, unknown> {
  return {
    version: 1,
    generadoEn: new Date(ahora).toISOString(),
    negocio: negocio.nombre,
    periodo,
    resumen: compararOperacion(ventas, periodo, ahora),
    inventario: valorInventarioOperacion(productos),
    clientes: clientes.map((cliente) => ({ ...cliente })),
    deudaAbierta: sumar(...vencimientosCarteraOperacion(fiados, pagos, clientes, ahora).map((item) => item.saldo)),
    pedidosAbiertos: pedidos.filter((pedido) => pedido.estado !== 'entregado' && pedido.estado !== 'cancelado').length,
    fiados: fiados.map((fiado) => ({ ...fiado })),
    pagos: pagos.map((pago) => ({ ...pago })),
    pedidos: pedidos.map((pedido) => ({ ...pedido, items: pedido.items.map((item) => ({ ...item })) })),
    ventas: ventasVigentes(ventas).map((venta) => ({ ...venta })),
    productos: productos.map((producto) => ({ ...producto })),
  }
}

/** 30. Mensaje ejecutivo para compartir el estado del negocio por WhatsApp. */
export function mensajeOperacion(
  negocio: string,
  comparativa: ComparativaOperacion,
  inventario: ValorInventarioOperacion,
  alertas: number,
  ahora: number = Date.now(),
): string {
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ahora))
  return [
    `*${negocio}* — Control Pro`,
    `Actualizado: ${fecha}`,
    '',
    `Facturación del período: ${formatearPesos(comparativa.actual)}`,
    `Variación: ${comparativa.porcentaje >= 0 ? '+' : ''}${comparativa.porcentaje}%`,
    `Ventas: ${comparativa.ventasActuales}`,
    `Inventario a costo: ${formatearPesos(inventario.aCosto)}`,
    `Alertas para revisar: ${alertas}`,
    '',
    'Informe generado desde Libreta.',
  ].join('\n')
}
