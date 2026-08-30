import Dexie, { type EntityTable } from 'dexie'
import type {
  Cierre, Cliente, Fiado, FiadoPago, Ingreso, Negocio, Producto, Venta,
} from '@/dominio/tipos'

/** Una operación pendiente de subir a la nube. */
export interface EnCola {
  id: string
  entidad: 'venta' | 'producto' | 'fiado' | 'fiadoPago' | 'ingreso' | 'cliente' | 'cierre'
  operacion: 'crear' | 'actualizar'
  datos: unknown
  intentos: number
  creadoEn: number
}

export const db = new Dexie('libreta') as Dexie & {
  productos: EntityTable<Producto, 'id'>
  ventas: EntityTable<Venta, 'id'>
  clientes: EntityTable<Cliente, 'id'>
  fiados: EntityTable<Fiado, 'id'>
  fiadoPagos: EntityTable<FiadoPago, 'id'>
  ingresos: EntityTable<Ingreso, 'id'>
  cierres: EntityTable<Cierre, 'id'>
  negocio: EntityTable<Negocio, 'id'>
  cola: EntityTable<EnCola, 'id'>
}

db.version(1).stores({
  productos: 'id, codigoBarras, nombre',
  ventas: 'id, fecha',
  clientes: 'id, nombre',
  fiados: 'id, clienteId, fecha',
  fiadoPagos: 'id, fiadoId',
  ingresos: 'id, fecha',
  negocio: 'id',
  cola: 'id, creadoEn',
})

db.version(2).stores({
  cierres: 'id, fecha',
})
