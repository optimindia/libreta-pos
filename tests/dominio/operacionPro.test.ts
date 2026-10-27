import { describe, expect, it } from 'vitest'
import type { Cliente, Fiado, FiadoPago, Pedido, Producto, Venta } from '@/dominio/tipos'
import {
  alertasPriorizadas,
  alertasMargenOperacion,
  clientesInactivosOperacion,
  clientesSinTelefonoOperacion,
  clientesTopOperacion,
  cobrosDigitalesSinReferencia,
  compararOperacion,
  coberturaStockOperacion,
  exportarOperacion,
  horariosRentables,
  integridadOperacion,
  metaOperacion,
  mensajeOperacion,
  mixCobrosOperacion,
  pedidosAtrasadosOperacion,
  pedidosParaHoyOperacion,
  radarRotacionOperacion,
  reservasEnRiesgoOperacion,
  riesgoCarteraOperacion,
  ritmoDiario,
  saludCatalogoOperacion,
  stockComprometidoOperacion,
  valorInventarioOperacion,
  vencimientosCarteraOperacion,
  recurrenciaClientesOperacion,
} from '@/dominio/operacionPro'

const DIA = 24 * 60 * 60 * 1000
const AHORA = new Date(2026, 7, 31, 15, 0).getTime()
const INICIO_HOY = new Date(2026, 7, 31).getTime()

const producto: Producto = {
  id: 'p1',
  codigoBarras: '779123',
  nombre: 'Yerba',
  costo: 30_000,
  precio: 50_000,
  stock: 3,
  stockMinimo: 2,
  actualizadoEn: AHORA,
}

const cliente: Cliente = { id: 'c1', nombre: 'Marta', telefono: null, limiteFiado: 100_000 }
const otroCliente: Cliente = { id: 'c2', nombre: 'Nico', telefono: '2615550000' }

function venta(
  id: string,
  fecha: number,
  total = 100_000,
  parcial: Partial<Venta> = {},
): Venta {
  return {
    id,
    fecha,
    total,
    medioPago: 'efectivo',
    clienteId: null,
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: total, costo: 30_000 }],
    ...parcial,
  }
}

function pedido(id: string, parcial: Partial<Pedido> = {}): Pedido {
  return {
    id,
    fecha: AHORA,
    actualizadoEn: AHORA,
    estado: 'pendiente',
    clienteId: 'c1',
    items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 50_000, costo: 30_000 }],
    total: 50_000,
    tipoEntrega: 'retiro',
    fechaEntrega: null,
    direccion: null,
    nota: null,
    reservarStock: false,
    ...parcial,
  }
}

function fiado(id: string, parcial: Partial<Fiado> = {}): Fiado {
  return {
    id,
    clienteId: 'c1',
    ventaId: null,
    monto: 120_000,
    fecha: AHORA - 10 * DIA,
    vence: AHORA + 2 * DIA,
    ...parcial,
  }
}

describe('Centro Pro: inteligencia operativa', () => {
  it('compara períodos, descubre horarios, arma el ritmo y mezcla cobros', () => {
    const ventas = [
      venta('actual', AHORA, 100_000),
      venta('anterior', AHORA - 7 * DIA, 70_000),
      venta('anulada', AHORA, 900_000, { estado: 'anulada' }),
      venta('qr', AHORA, 200_000, { medioPago: 'qr' }),
    ]

    expect(compararOperacion(ventas, 'hoy', AHORA)).toMatchObject({ actual: 300_000, anterior: 70_000, ventasActuales: 2, ventasAnteriores: 1 })
    expect(horariosRentables(ventas, 'hoy', AHORA)[0].vendido).toBe(300_000)
    expect(ritmoDiario(ventas, 7, AHORA)).toHaveLength(7)
    expect(ritmoDiario(ventas, 7, AHORA)[6]?.vendido).toBe(300_000)
    expect(mixCobrosOperacion(ventas, 'hoy', AHORA)).toMatchObject([
      { medio: 'qr', monto: 200_000, porcentaje: 67 },
      { medio: 'efectivo', monto: 100_000, porcentaje: 33 },
    ])
    expect(cobrosDigitalesSinReferencia(ventas, 'hoy', AHORA).map((item) => item.id)).toEqual(['qr'])
    expect(metaOperacion(750_000, 1_000_000)).toMatchObject({ porcentaje: 75, restante: 250_000, cumplido: false })
  })

  it('mide inventario, cobertura, rotación, margen y calidad de catálogo', () => {
    const agotado: Producto = { ...producto, id: 'p2', codigoBarras: null, nombre: 'Galletas', costo: 10_000, precio: 8_000, stock: 0, stockMinimo: 2 }
    const ventas = [venta('rotacion', AHORA - DIA, 350_000, { items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 7, precio: 350_000, costo: 210_000 }] })]

    expect(valorInventarioOperacion([producto, agotado])).toEqual({ unidades: 3, aCosto: 90_000, aPrecio: 150_000, margenPotencial: 60_000 })
    expect(coberturaStockOperacion([producto, agotado], ventas, AHORA)).toMatchObject([
      { producto: { id: 'p2' }, estado: 'agotado' },
      { producto: { id: 'p1' }, unidadesVendidas: 7, diasCobertura: 6, estado: 'vigilar' },
    ])
    expect(radarRotacionOperacion([producto, agotado], ventas, AHORA)[0].producto.id).toBe('p1')
    expect(alertasMargenOperacion([producto, agotado]).map((item) => item.producto.id)).toEqual(['p2'])
    expect(saludCatalogoOperacion([producto, agotado])).toMatchObject({ total: 2, completos: 1, sinCodigo: 1, debajoDelCosto: 1, sinStock: 1, porcentajeCompleto: 50 })
  })

  it('prioriza clientes, recurrencia, inactividad y datos de contacto', () => {
    const ventas = [
      venta('marta-1', AHORA, 100_000, { clienteId: 'c1' }),
      venta('marta-2', AHORA - 2 * DIA, 100_000, { clienteId: 'c1' }),
      venta('nico', AHORA - 40 * DIA, 70_000, { clienteId: 'c2' }),
    ]
    const clientes = [cliente, otroCliente]

    expect(clientesTopOperacion(ventas, clientes)[0]).toMatchObject({ cliente: cliente, ventas: 2, gastado: 200_000, ticketPromedio: 100_000 })
    expect(recurrenciaClientesOperacion(ventas, clientes)).toEqual({ clientesConCompras: 2, recurrentes: 1, porcentaje: 50 })
    expect(clientesInactivosOperacion(ventas, clientes, AHORA, 30).map((item) => item.cliente.id)).toEqual(['c2'])
    expect(clientesSinTelefonoOperacion(clientes, ventas).map((item) => item.id)).toEqual(['c1'])
  })

  it('controla deuda, vencimientos, reservas y agenda de entregas', () => {
    const fiadoVigente = fiado('f1')
    const fiadoVencido = fiado('f2', { id: 'f2', clienteId: 'c2', monto: 50_000, fecha: AHORA - 40 * DIA, vence: AHORA - 2 * DIA })
    const pagos: FiadoPago[] = [{ id: 'pago-1', fiadoId: 'f1', monto: 20_000, fecha: AHORA }]
    const clientes = [cliente, otroCliente]
    const vencimientos = vencimientosCarteraOperacion([fiadoVigente, fiadoVencido], pagos, clientes, AHORA)
    expect(vencimientos.map((item) => item.estado)).toEqual(['vencido', 'pronto'])
    expect(vencimientos.map((item) => item.saldo)).toEqual([50_000, 100_000])
    expect(riesgoCarteraOperacion([fiadoVigente, fiadoVencido], pagos, clientes, AHORA).every((item) => item.riesgo === 'alto')).toBe(true)

    const hoy = pedido('hoy', { fechaEntrega: INICIO_HOY })
    const atrasado = pedido('atrasado', { fechaEntrega: INICIO_HOY - DIA })
    const productos = [producto]
    expect(pedidosParaHoyOperacion([hoy, atrasado], clientes, AHORA).map((item) => item.pedido.id)).toEqual(['hoy'])
    expect(pedidosAtrasadosOperacion([hoy, atrasado], clientes, AHORA).map((item) => item.pedido.id)).toEqual(['atrasado'])
    expect(stockComprometidoOperacion([{ ...hoy, reservarStock: true }], productos)).toEqual({ unidades: 1, valor: 50_000, productos: 1 })
    expect(reservasEnRiesgoOperacion([{ ...hoy, reservarStock: true }], [{ ...producto, stock: 1 }])[0]).toMatchObject({ nivel: 'atencion', disponibleDespuesDeReservas: 0 })
  })

  it('encuentra inconsistencias, genera alertas y exporta un informe completo', () => {
    const duplicado: Producto = { ...producto, id: 'p2', nombre: ' yerba ', precio: 20_000, stock: -1 }
    const sinCliente = venta('fiado-sin-cliente', AHORA, 50_000, { medioPago: 'fiado' })
    const pedidoVacio = pedido('vacio', { items: [] })
    const fiadoExcedido = fiado('excedido', { monto: 10_000 })
    const pagos: FiadoPago[] = [{ id: 'pago-excedido', fiadoId: 'excedido', monto: 20_000, fecha: AHORA }]
    const problemas = integridadOperacion([producto, duplicado], [sinCliente], [fiadoExcedido], pagos, [pedidoVacio])
    expect(problemas.map((item) => item.titulo)).toEqual(expect.arrayContaining(['Nombres de producto duplicados', 'Códigos de barras repetidos', 'Stock negativo', 'Fiados sin cliente', 'Pedidos vacíos', 'Pagos excedidos']))

    const ventas = [venta('digital', AHORA, 100_000, { medioPago: 'transferencia' })]
    const alertas = alertasPriorizadas([duplicado], ventas, [fiado('vencido', { vence: AHORA - DIA })], [], [pedido('atrasado', { fechaEntrega: INICIO_HOY - DIA, reservarStock: true })], AHORA)
    expect(alertas.map((alerta) => alerta.id)).toEqual(expect.arrayContaining(['stock-agotado', 'fiado-vencido', 'pedido-atrasado', 'margen-revisar', 'cobro-sin-referencia']))

    const informe = exportarOperacion({ nombre: 'Mi almacén' }, 'hoy', ventas, [producto], [cliente], [], [], [pedido('p1')], AHORA)
    expect(informe).toMatchObject({ negocio: 'Mi almacén', periodo: 'hoy', clientes: [cliente], fiados: [], pagos: [], pedidosAbiertos: 1 })
    expect(informe.ventas).toHaveLength(1)
    expect(mensajeOperacion('Mi almacén', compararOperacion(ventas, 'hoy', AHORA), valorInventarioOperacion([producto]), alertas.length, AHORA)).toContain('Facturación del período: $1.000')
  })
})
