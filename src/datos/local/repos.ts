import { db } from './db'
import { encolar } from './cola'
import type {
  Cierre, Cliente, Centavos, EstadoPedido, Fiado, Ingreso, ItemVenta, MedioPago, MovimientoCaja, Pedido, PreferenciasNegocio, Producto, UUID, Venta,
} from '@/dominio/tipos'
import type { FuncionesNegocio } from '@/dominio/funciones'
import { normalizarFunciones } from '@/dominio/funciones'
import { nuevoId } from '@/dominio/id'
import { totalTicket } from '@/dominio/ticket'
import { saldoFiado } from '@/dominio/fiado'
import { pedidoReservaStock, totalPedido } from '@/dominio/pedidos'

/** Quita acentos y pasa a minúscula, para buscar "playadito" y encontrar "Playadito". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const ESTADOS_PEDIDO_RESERVA: Set<EstadoPedido> = new Set(['pendiente', 'preparando', 'listo'])
type OrigenMovimientoStock = 'ajuste' | 'venta' | 'anulacion' | 'ingreso'

async function encolarMovimientoStock(
  productoId: UUID,
  cantidad: number,
  origen: OrigenMovimientoStock,
  referenciaId?: UUID,
): Promise<void> {
  await encolar('movimientoStock', 'crear', {
    id: nuevoId(),
    productoId,
    cantidad,
    origen,
    referenciaId,
  })
}

async function obtenerPreferenciasLocales(): Promise<PreferenciasNegocio> {
  const [actual, negocio] = await Promise.all([
    db.preferencias.get('unico'),
    db.negocio.get('unico'),
  ])
  return {
    id: 'unico',
    negocioId: actual?.negocioId ?? negocio?.negocioId,
    funciones: normalizarFunciones(actual?.funciones),
    actualizadoEn: actual?.actualizadoEn ?? 0,
  }
}

async function cantidadesReservadas(exceptoPedidoId?: UUID): Promise<Map<UUID, number>> {
  const pedidos = await db.pedidos.toArray()
  const reservadas = new Map<UUID, number>()
  for (const pedido of pedidos) {
    if (pedido.id === exceptoPedidoId || !pedidoReservaStock(pedido) || !ESTADOS_PEDIDO_RESERVA.has(pedido.estado)) continue
    for (const item of pedido.items) {
      reservadas.set(item.productoId, (reservadas.get(item.productoId) ?? 0) + item.cantidad)
    }
  }
  return reservadas
}

export interface FiadoAbierto extends Fiado {
  saldo: Centavos
}

export class ErrorStockInsuficiente extends Error {
  constructor(public readonly producto: string, public readonly disponible: number) {
    super(`Stock insuficiente para ${producto}`)
    this.name = 'ErrorStockInsuficiente'
  }
}

export class ErrorVentaYaAnulada extends Error {
  constructor() {
    super('Esta venta ya fue anulada.')
    this.name = 'ErrorVentaYaAnulada'
  }
}

export class ErrorVentaNoAnulable extends Error {
  constructor(public readonly motivo: string) {
    super(motivo)
    this.name = 'ErrorVentaNoAnulable'
  }
}

export class ErrorClienteConHistorial extends Error {
  constructor(
    public readonly ventas: number,
    public readonly fiados: number,
    public readonly pedidos: number,
  ) {
    const referencias = [
      ventas > 0 ? `${ventas} ${ventas === 1 ? 'venta' : 'ventas'}` : null,
      fiados > 0 ? `${fiados} ${fiados === 1 ? 'fiado' : 'fiados'}` : null,
      pedidos > 0 ? `${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}` : null,
    ].filter(Boolean).join(', ')
    super(`No se puede eliminar este cliente porque tiene historial: ${referencias}. Conservamos esos registros para cuidar tus cuentas.`)
    this.name = 'ErrorClienteConHistorial'
  }
}

export class ErrorProductoConHistorial extends Error {
  constructor(
    public readonly ventas: number,
    public readonly ingresos: number,
    public readonly pedidos: number,
  ) {
    const referencias = [
      ventas > 0 ? `${ventas} ${ventas === 1 ? 'venta' : 'ventas'}` : null,
      ingresos > 0 ? `${ingresos} ${ingresos === 1 ? 'ingreso' : 'ingresos'}` : null,
      pedidos > 0 ? `${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}` : null,
    ].filter(Boolean).join(', ')
    super(`No se puede eliminar este producto porque tiene historial: ${referencias}. Conservamos esos registros para cuidar tus cuentas.`)
    this.name = 'ErrorProductoConHistorial'
  }
}

export const repos = {
  productos: {
    async guardar(datos: Omit<Producto, 'id' | 'actualizadoEn'> & { id?: UUID }): Promise<Producto> {
      const producto: Producto = {
        ...datos,
        id: datos.id ?? nuevoId(),
        actualizadoEn: Date.now(),
      }
      await db.productos.put(producto)
      await encolar('producto', datos.id ? 'actualizar' : 'crear', producto)
      return producto
    },
    async porCodigoBarras(codigo: string): Promise<Producto | null> {
      return (await db.productos.where('codigoBarras').equals(codigo).filter((producto) => !producto.eliminadoEn).first()) ?? null
    },
    async todos(): Promise<Producto[]> {
      return db.productos.filter((producto) => !producto.eliminadoEn).toArray()
    },
    async buscar(texto: string): Promise<Producto[]> {
      const aguja = normalizar(texto)
      const todos = await db.productos.toArray()
      return todos.filter((producto) => !producto.eliminadoEn && (
        normalizar(producto.nombre).includes(aguja) ||
        (producto.codigoBarras ? producto.codigoBarras.includes(texto.trim()) : false)
      ))
    },
    async ajustarStock(id: UUID, cambio: number): Promise<Producto | null> {
      if (!Number.isInteger(cambio) || cambio === 0) return null
      let actualizado: Producto | null = null
      await db.transaction('rw', db.productos, async () => {
        const actual = await db.productos.get(id)
        if (!actual) return
        if (cambio < 0 && actual.stock + cambio < 0) {
          throw new ErrorStockInsuficiente(actual.nombre, actual.stock)
        }
        actualizado = { ...actual, stock: actual.stock + cambio, actualizadoEn: Date.now() }
        await db.productos.put(actualizado)
      })
      if (!actualizado) return null
      await encolarMovimientoStock(id, cambio, 'ajuste')
      return actualizado
    },
    async marcarFavorito(id: UUID, favorito: boolean): Promise<Producto | null> {
      const actual = await db.productos.get(id)
      if (!actual) return null
      const actualizado = { ...actual, favorito, actualizadoEn: Date.now() }
      await db.productos.put(actualizado)
      await encolar('producto', 'actualizar', actualizado)
      return actualizado
    },
    async actualizarCategoria(id: UUID, categoria: string): Promise<Producto | null> {
      const actual = await db.productos.get(id)
      if (!actual) return null
      const actualizado = { ...actual, categoria: categoria.trim() || undefined, actualizadoEn: Date.now() }
      await db.productos.put(actualizado)
      await encolar('producto', 'actualizar', actualizado)
      return actualizado
    },
    /** El borrado de un producto es seguro sólo si no hay documentos que lo
     *  referencien. En la nube se propaga como una marca de borrado para que
     *  los demás dispositivos también lo retiren, sin tocar la auditoría. */
    async eliminar(id: UUID): Promise<boolean> {
      let eliminado = false

      await db.transaction('rw', [db.productos, db.ventas, db.ingresos, db.pedidos], async () => {
        const producto = await db.productos.get(id)
        if (!producto) return

        const ventas = (await db.ventas.toArray()).filter((venta) => venta.items.some((item) => item.productoId === id))
        const ingresos = (await db.ingresos.toArray()).filter((ingreso) => ingreso.items.some((item) => item.productoId === id))
        const pedidos = (await db.pedidos.toArray()).filter((pedido) => pedido.items.some((item) => item.productoId === id))
        if (ventas.length > 0 || ingresos.length > 0 || pedidos.length > 0) {
          throw new ErrorProductoConHistorial(ventas.length, ingresos.length, pedidos.length)
        }

        await db.productos.delete(id)
        eliminado = true
      })

      if (eliminado) await encolar('producto', 'eliminar', { id, eliminadoEn: Date.now() })
      return eliminado
    },
  },

  ventas: {
    async registrar(datos: {
      items: ItemVenta[]
      medioPago: MedioPago
      clienteId: UUID | null
      vence?: number | null
      referenciaPago?: string
      pedidoId?: UUID
    }): Promise<Venta> {
      const venta: Venta = {
        id: nuevoId(),
        fecha: Date.now(),
        total: totalTicket(datos.items),
        medioPago: datos.medioPago,
        items: datos.items,
        clienteId: datos.clienteId,
        estado: 'completada',
        estadoCobro: 'confirmado',
        referenciaPago: datos.referenciaPago?.trim() || undefined,
        pedidoId: datos.pedidoId,
      }
      const tocados: Producto[] = []
      let fiado: Fiado | null = null
      await db.transaction('rw', db.ventas, db.productos, db.fiados, db.pedidos, async () => {
        const reservadas = await cantidadesReservadas(datos.pedidoId)
        const cantidades = new Map<UUID, number>()
        for (const item of venta.items) cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad)
        for (const [productoId, cantidad] of cantidades) {
          const producto = await db.productos.get(productoId)
          const disponible = producto ? Math.max(0, producto.stock - (reservadas.get(productoId) ?? 0)) : 0
          if (!producto || disponible < cantidad) throw new ErrorStockInsuficiente(producto?.nombre ?? 'este producto', disponible)
        }
        await db.ventas.add(venta)
        for (const item of venta.items) {
          const producto = await db.productos.get(item.productoId)
          if (producto) {
            const descontado = { ...producto, stock: producto.stock - item.cantidad, actualizadoEn: Date.now() }
            await db.productos.put(descontado)
            tocados.push(descontado)
          }
        }
        if (venta.medioPago === 'fiado' && venta.clienteId) {
          fiado = {
            id: nuevoId(),
            clienteId: venta.clienteId,
            ventaId: venta.id,
            monto: venta.total,
            fecha: venta.fecha,
            vence: datos.vence ?? null,
          }
          await db.fiados.add(fiado)
        }
      })
      // El stock tocado también viaja a la nube: si no, el otro aparato
      // nunca se entera de lo que vendió éste.
      for (const producto of tocados) {
        await encolar('producto', 'actualizar', producto)
      }
      for (const item of venta.items) {
        await encolarMovimientoStock(item.productoId, -item.cantidad, 'venta', venta.id)
      }
      await encolar('venta', 'crear', venta)
      if (fiado) await encolar('fiado', 'crear', fiado)
      return venta
    },
    /** Anula una venta sin borrarla: devuelve mercadería, cierra el fiado
     *  asociado si todavía no tuvo pagos y deja un movimiento de devolución
     *  cuando el cobro fue en efectivo. */
    async anular(id: UUID, motivo: string): Promise<Venta> {
      const venta = await db.ventas.get(id)
      if (!venta) throw new ErrorVentaNoAnulable('No encontramos esa venta.')
      if (venta.estado === 'anulada') throw new ErrorVentaYaAnulada()

      const ahora = Date.now()
      const motivoFinal = motivo.trim() || 'Corrección de venta'
      const tocados: Producto[] = []
      const movimientosStock: Array<{ productoId: UUID; cantidad: number }> = []
      let fiadoActualizado: Fiado | null = null
      let devolucion: MovimientoCaja | null = null
      const ventaAnulada: Venta = {
        ...venta,
        estado: 'anulada',
        anuladaEn: ahora,
        motivoAnulacion: motivoFinal,
      }

      await db.transaction('rw', [db.ventas, db.productos, db.fiados, db.fiadoPagos, db.movimientosCaja], async () => {
        const actual = await db.ventas.get(id)
        if (!actual) throw new ErrorVentaNoAnulable('No encontramos esa venta.')
        if (actual.estado === 'anulada') throw new ErrorVentaYaAnulada()

        if (actual.medioPago === 'fiado') {
          const fiado = (await db.fiados.toArray()).find((item) => item.ventaId === actual.id && !item.anuladoEn)
          if (fiado) {
            const pagos = await db.fiadoPagos.where('fiadoId').equals(fiado.id).toArray()
            if (pagos.some((pago) => pago.monto > 0)) {
              throw new ErrorVentaNoAnulable('No se puede anular un fiado que ya tiene pagos. Revisá la cuenta del cliente.')
            }
            fiadoActualizado = { ...fiado, anuladoEn: ahora }
            await db.fiados.put(fiadoActualizado)
          }
        }

        const cantidades = new Map<UUID, number>()
        for (const item of actual.items) {
          cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad)
        }
        for (const [productoId, cantidad] of cantidades) {
          const producto = await db.productos.get(productoId)
          if (!producto) continue
          const restaurado = { ...producto, stock: producto.stock + cantidad, actualizadoEn: Date.now() }
          await db.productos.put(restaurado)
          tocados.push(restaurado)
          movimientosStock.push({ productoId, cantidad })
        }

        await db.ventas.put(ventaAnulada)

        if (actual.medioPago === 'efectivo') {
          devolucion = {
            id: nuevoId(),
            fecha: ahora,
            tipo: 'salida',
            concepto: `Devolución de venta ${actual.id.slice(0, 6)}`,
            monto: actual.total,
            medioPago: 'efectivo',
          }
          await db.movimientosCaja.add(devolucion)
        }
      })

      for (const producto of tocados) await encolar('producto', 'actualizar', producto)
      for (const movimiento of movimientosStock) {
        await encolarMovimientoStock(movimiento.productoId, movimiento.cantidad, 'anulacion', ventaAnulada.id)
      }
      await encolar('venta', 'actualizar', ventaAnulada)
      if (fiadoActualizado) await encolar('fiado', 'actualizar', fiadoActualizado)
      if (devolucion) await encolar('movimientoCaja', 'crear', devolucion)
      return ventaAnulada
    },
    async todas(): Promise<Venta[]> {
      return db.ventas.orderBy('fecha').reverse().toArray()
    },
    async porId(id: UUID): Promise<Venta | null> {
      return (await db.ventas.get(id)) ?? null
    },
    async buscar(texto: string): Promise<Venta[]> {
      const aguja = normalizar(texto)
      const ventas = await db.ventas.orderBy('fecha').reverse().toArray()
      if (aguja === '') return ventas
      return ventas.filter((venta) =>
        venta.items.some((item) => normalizar(item.nombre).includes(aguja)) ||
        venta.medioPago.includes(aguja),
      )
    },
  },

  clientes: {
    async guardar(datos: Omit<Cliente, 'id'>): Promise<Cliente> {
      const cliente: Cliente = { ...datos, id: nuevoId() }
      await db.clientes.add(cliente)
      await encolar('cliente', 'crear', cliente)
      return cliente
    },
    async todos(): Promise<Cliente[]> {
      return db.clientes.toArray()
    },
    async buscar(texto: string): Promise<Cliente[]> {
      const aguja = normalizar(texto)
      const clientes = await db.clientes.toArray()
      if (aguja === '') return clientes
      return clientes.filter((cliente) => normalizar(`${cliente.nombre} ${cliente.telefono ?? ''}`).includes(aguja))
    },
    async actualizar(id: UUID, datos: Partial<Omit<Cliente, 'id'>>): Promise<Cliente | null> {
      const actual = await db.clientes.get(id)
      if (!actual) return null
      const actualizado = { ...actual, ...datos, id }
      await db.clientes.put(actualizado)
      await encolar('cliente', 'actualizar', actualizado)
      return actualizado
    },
    async eliminar(id: UUID): Promise<boolean> {
      let eliminado = false

      await db.transaction('rw', [db.clientes, db.ventas, db.fiados, db.pedidos], async () => {
        const cliente = await db.clientes.get(id)
        if (!cliente) return

        const ventas = (await db.ventas.toArray()).filter((venta) => venta.clienteId === id)
        const fiados = await db.fiados.where('clienteId').equals(id).toArray()
        const pedidos = await db.pedidos.where('clienteId').equals(id).toArray()
        if (ventas.length > 0 || fiados.length > 0 || pedidos.length > 0) {
          throw new ErrorClienteConHistorial(ventas.length, fiados.length, pedidos.length)
        }

        await db.clientes.delete(id)
        eliminado = true
      })

      if (eliminado) await encolar('cliente', 'eliminar', { id })
      return eliminado
    },
  },

  fiados: {
    async anotar(datos: Omit<Fiado, 'id' | 'fecha'>): Promise<Fiado> {
      const fiado: Fiado = { ...datos, id: nuevoId(), fecha: Date.now() }
      await db.fiados.add(fiado)
      await encolar('fiado', 'crear', fiado)
      return fiado
    },
    async pagar(fiadoId: UUID, monto: Centavos): Promise<void> {
      const fiado = await db.fiados.get(fiadoId)
      if (!fiado || fiado.anuladoEn || !Number.isFinite(monto) || monto <= 0) return
      const pago = { id: nuevoId(), fiadoId, monto, fecha: Date.now() }
      await db.fiadoPagos.add(pago)
      await encolar('fiadoPago', 'crear', pago)
    },
    async pagarCliente(clienteId: UUID, monto: Centavos): Promise<Centavos> {
      if (!Number.isFinite(monto) || monto <= 0) return 0
      const [fiados, pagos] = await Promise.all([
        db.fiados.where('clienteId').equals(clienteId).toArray(),
        db.fiadoPagos.toArray(),
      ])
      let restante = Math.round(monto)
      const ordenados = fiados.sort((a, b) => a.fecha - b.fecha)
      for (const fiado of ordenados) {
        const yaPagado = pagos
          .filter((pago) => pago.fiadoId === fiado.id)
          .reduce((total, pago) => total + pago.monto, 0)
        const saldo = Math.max(0, fiado.monto - yaPagado)
        const abono = Math.min(restante, saldo)
        if (abono > 0) await this.pagar(fiado.id, abono)
        restante -= abono
        if (restante === 0) break
      }
      return Math.round(monto) - restante
    },
    async abiertos(): Promise<FiadoAbierto[]> {
      const [fiados, pagos] = await Promise.all([
        db.fiados.toArray(),
        db.fiadoPagos.toArray(),
      ])
      return fiados
        .map((fiado) => ({ ...fiado, saldo: saldoFiado(fiado, pagos) }))
        .filter((fiado) => fiado.saldo > 0)
    },
    async pagos() {
      return db.fiadoPagos.toArray()
    },
  },

  movimientosCaja: {
    async registrar(datos: Omit<MovimientoCaja, 'id' | 'fecha'>): Promise<MovimientoCaja> {
      const movimiento: MovimientoCaja = {
        ...datos,
        concepto: datos.concepto.trim(),
        monto: Math.round(datos.monto),
        id: nuevoId(),
        fecha: Date.now(),
      }
      await db.movimientosCaja.add(movimiento)
      await encolar('movimientoCaja', 'crear', movimiento)
      return movimiento
    },
    async todos(): Promise<MovimientoCaja[]> {
      return db.movimientosCaja.orderBy('fecha').reverse().toArray()
    },
    async entre(desde: number, hasta: number): Promise<MovimientoCaja[]> {
      return db.movimientosCaja.where('fecha').between(desde, hasta, true, true).toArray()
    },
    async eliminar(id: UUID): Promise<void> {
      const movimiento = await db.movimientosCaja.get(id)
      if (!movimiento) return
      await db.movimientosCaja.delete(id)
      await encolar('movimientoCaja', 'eliminar', { id: movimiento.id })
    },
  },

  cierres: {
    async registrar(datos: Omit<Cierre, 'id' | 'fecha'>): Promise<Cierre> {
      // La fecha siempre supera al último cierre: dos cierres guardados en el
      // mismo milisegundo no pueden empatar, o "el último" queda ambiguo.
      const anterior = await db.cierres.orderBy('fecha').last()
      const fecha = Math.max(Date.now(), (anterior?.fecha ?? 0) + 1)
      const cierre: Cierre = { ...datos, id: nuevoId(), fecha }
      await db.cierres.add(cierre)
      await encolar('cierre', 'crear', cierre)
      return cierre
    },
    async todos(): Promise<Cierre[]> {
      return db.cierres.orderBy('fecha').reverse().toArray()
    },
    async ultimo(): Promise<Cierre | null> {
      return (await db.cierres.orderBy('fecha').last()) ?? null
    },
  },

  negocio: {
    /** Guarda sólo los ajustes visibles; el vínculo con la nube, el
     *  teléfono y el cursor de bajada de la fila quedan intactos.
     *  (Un put directo de Dexie reemplazaría la fila entera.) */
    async guardarAjustes(
      nombre: string,
      logo: string | null,
      color: string | null,
    ): Promise<void> {
      const actual = await db.negocio.get('unico')
      await db.negocio.put({
        id: 'unico',
        nombre,
        logo,
        color,
        negocioId: actual?.negocioId,
        telefono: actual?.telefono,
        ultimaBajada: actual?.ultimaBajada,
        usuarioId: actual?.usuarioId,
        suscripcionEstado: actual?.suscripcionEstado,
        suscripcionTipo: actual?.suscripcionTipo,
        suscripcionVenceEn: actual?.suscripcionVenceEn,
        suscripcionGraciaHasta: actual?.suscripcionGraciaHasta,
        suscripcionActualizadaEn: actual?.suscripcionActualizadaEn,
      })
    },
  },

  preferencias: {
    async obtener(): Promise<PreferenciasNegocio> {
      return obtenerPreferenciasLocales()
    },
    async guardarFunciones(funciones: Partial<FuncionesNegocio>): Promise<PreferenciasNegocio> {
      const [actual, negocio] = await Promise.all([
        obtenerPreferenciasLocales(),
        db.negocio.get('unico'),
      ])
      const siguiente: PreferenciasNegocio = {
        id: 'unico',
        negocioId: negocio?.negocioId ?? actual.negocioId,
        funciones: normalizarFunciones({ ...actual.funciones, ...funciones }),
        actualizadoEn: Math.max(Date.now(), actual.actualizadoEn + 1),
      }
      await db.preferencias.put(siguiente)
      if (siguiente.negocioId) await encolar('preferencias', 'actualizar', siguiente)
      return siguiente
    },
  },

  ingresos: {
    async registrar(datos: Omit<Ingreso, 'id' | 'fecha'>): Promise<Ingreso> {
      const ingreso: Ingreso = { ...datos, id: nuevoId(), fecha: Date.now() }
      const tocados: Producto[] = []
      await db.transaction('rw', db.ingresos, db.productos, async () => {
        await db.ingresos.add(ingreso)
        for (const item of ingreso.items) {
          const producto = await db.productos.get(item.productoId)
          if (producto) {
            const cargado = { ...producto, stock: producto.stock + item.cantidad, costo: item.costoUnitario, actualizadoEn: Date.now() }
            await db.productos.put(cargado)
            tocados.push(cargado)
          }
        }
      })
      // El stock cargado también viaja a la nube: si no, el otro aparato
      // nunca se entera de lo que entró en éste.
      for (const producto of tocados) {
        await encolar('producto', 'actualizar', producto)
      }
      for (const item of ingreso.items) {
        await encolarMovimientoStock(item.productoId, item.cantidad, 'ingreso', ingreso.id)
      }
      await encolar('ingreso', 'crear', ingreso)
      return ingreso
    },
    async todos(): Promise<Ingreso[]> {
      return db.ingresos.toArray()
    },
  },

  pedidos: {
    async guardar(datos: Omit<Pedido, 'id' | 'fecha' | 'actualizadoEn' | 'total'> & { id?: UUID }): Promise<Pedido> {
      if (!datos.items.length) throw new Error('Un pedido necesita al menos un producto.')
      const existente = datos.id ? await db.pedidos.get(datos.id) : undefined
      const pedido: Pedido = {
        ...datos,
        id: datos.id ?? nuevoId(),
        fecha: existente?.fecha ?? Date.now(),
        actualizadoEn: Date.now(),
        total: totalPedido(datos.items),
        nota: datos.nota?.trim() || null,
        direccion: datos.direccion?.trim() || null,
      }

      if (pedidoReservaStock(pedido)) {
        const reservadas = await cantidadesReservadas(pedido.id)
        const cantidades = new Map<UUID, number>()
        for (const item of pedido.items) cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad)
        for (const [productoId, cantidad] of cantidades) {
          const producto = await db.productos.get(productoId)
          const disponible = producto ? Math.max(0, producto.stock - (reservadas.get(productoId) ?? 0)) : 0
          if (!producto || disponible < cantidad) throw new ErrorStockInsuficiente(producto?.nombre ?? 'este producto', disponible)
        }
      }

      await db.pedidos.put(pedido)
      await encolar('pedido', existente ? 'actualizar' : 'crear', pedido)
      return pedido
    },
    async todos(): Promise<Pedido[]> {
      return db.pedidos.orderBy('fecha').reverse().toArray()
    },
    async porId(id: UUID): Promise<Pedido | null> {
      return (await db.pedidos.get(id)) ?? null
    },
    async abiertos(): Promise<Pedido[]> {
      return (await this.todos()).filter((pedido) => pedido.estado !== 'entregado' && pedido.estado !== 'cancelado')
    },
    async actualizarEstado(id: UUID, estado: EstadoPedido): Promise<Pedido | null> {
      const pedido = await db.pedidos.get(id)
      if (!pedido || pedido.estado === 'cancelado' || pedido.estado === 'entregado') return pedido ?? null
      const actualizado: Pedido = { ...pedido, estado, actualizadoEn: Date.now() }
      await db.pedidos.put(actualizado)
      await encolar('pedido', 'actualizar', actualizado)
      return actualizado
    },
    async cancelar(id: UUID): Promise<Pedido | null> {
      return this.actualizarEstado(id, 'cancelado')
    },
    async convertirEnVenta(id: UUID, medioPago: MedioPago, referenciaPago?: string): Promise<Venta> {
      const pedido = await db.pedidos.get(id)
      if (!pedido) throw new Error('No encontramos ese pedido.')
      if (pedido.estado === 'cancelado') throw new Error('El pedido está cancelado.')
      if (pedido.ventaId) {
        const ventaExistente = await db.ventas.get(pedido.ventaId)
        if (ventaExistente && ventaExistente.estado !== 'anulada') return ventaExistente
      }
      // Si la pestaña se cerró justo después de registrar la venta, el
      // vínculo del pedido puede no haber alcanzado a guardarse. Buscar por
      // pedido hace la conversión idempotente y evita cobrar/descontar dos veces.
      const ventaYaCreada = (await db.ventas.toArray()).find((venta) => venta.pedidoId === id && venta.estado !== 'anulada')
      if (ventaYaCreada) {
        const sincronizado: Pedido = { ...pedido, estado: 'entregado', ventaId: ventaYaCreada.id, actualizadoEn: Date.now() }
        await db.pedidos.put(sincronizado)
        await encolar('pedido', 'actualizar', sincronizado)
        return ventaYaCreada
      }
      if (medioPago === 'fiado' && !pedido.clienteId) throw new Error('Asigná un cliente antes de cobrar a cuenta.')
      const venta = await repos.ventas.registrar({
        items: pedido.items,
        medioPago,
        clienteId: pedido.clienteId,
        referenciaPago,
        pedidoId: pedido.id,
      })
      const actualizado: Pedido = { ...pedido, estado: 'entregado', ventaId: venta.id, actualizadoEn: Date.now() }
      await db.pedidos.put(actualizado)
      await encolar('pedido', 'actualizar', actualizado)
      return venta
    },
    async reservadasPorProducto(): Promise<Map<UUID, number>> {
      return cantidadesReservadas()
    },
  },
}
