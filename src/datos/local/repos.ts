import { db } from './db'
import { encolar } from './cola'
import type {
  Cliente, Centavos, Fiado, Ingreso, ItemVenta, MedioPago, Producto, UUID, Venta,
} from '@/dominio/tipos'
import { totalTicket } from '@/dominio/ticket'
import { saldoFiado } from '@/dominio/fiado'

const nuevoId = (): UUID => crypto.randomUUID()

/** Quita acentos y pasa a minúscula, para buscar "playadito" y encontrar "Playadito". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export interface FiadoAbierto extends Fiado {
  saldo: Centavos
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
      return (await db.productos.where('codigoBarras').equals(codigo).first()) ?? null
    },
    async todos(): Promise<Producto[]> {
      return db.productos.toArray()
    },
    async buscar(texto: string): Promise<Producto[]> {
      const aguja = normalizar(texto)
      const todos = await db.productos.toArray()
      return todos.filter((producto) => normalizar(producto.nombre).includes(aguja))
    },
  },

  ventas: {
    async registrar(datos: {
      items: ItemVenta[]
      medioPago: MedioPago
      clienteId: UUID | null
    }): Promise<Venta> {
      const venta: Venta = {
        id: nuevoId(),
        fecha: Date.now(),
        total: totalTicket(datos.items),
        medioPago: datos.medioPago,
        items: datos.items,
        clienteId: datos.clienteId,
      }
      await db.transaction('rw', db.ventas, db.productos, async () => {
        await db.ventas.add(venta)
        for (const item of venta.items) {
          const producto = await db.productos.get(item.productoId)
          if (producto) {
            await db.productos.update(item.productoId, {
              stock: producto.stock - item.cantidad,
            })
          }
        }
      })
      await encolar('venta', 'crear', venta)
      return venta
    },
    async todas(): Promise<Venta[]> {
      return db.ventas.orderBy('fecha').reverse().toArray()
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
  },

  fiados: {
    async anotar(datos: Omit<Fiado, 'id' | 'fecha'>): Promise<Fiado> {
      const fiado: Fiado = { ...datos, id: nuevoId(), fecha: Date.now() }
      await db.fiados.add(fiado)
      await encolar('fiado', 'crear', fiado)
      return fiado
    },
    async pagar(fiadoId: UUID, monto: Centavos): Promise<void> {
      const pago = { id: nuevoId(), fiadoId, monto, fecha: Date.now() }
      await db.fiadoPagos.add(pago)
      await encolar('fiadoPago', 'crear', pago)
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

  ingresos: {
    async registrar(datos: Omit<Ingreso, 'id' | 'fecha'>): Promise<Ingreso> {
      const ingreso: Ingreso = { ...datos, id: nuevoId(), fecha: Date.now() }
      await db.transaction('rw', db.ingresos, db.productos, async () => {
        await db.ingresos.add(ingreso)
        for (const item of ingreso.items) {
          const producto = await db.productos.get(item.productoId)
          if (producto) {
            await db.productos.update(item.productoId, {
              stock: producto.stock + item.cantidad,
              costo: item.costoUnitario,
              actualizadoEn: Date.now(),
            })
          }
        }
      })
      await encolar('ingreso', 'crear', ingreso)
      return ingreso
    },
    async todos(): Promise<Ingreso[]> {
      return db.ingresos.toArray()
    },
  },
}
