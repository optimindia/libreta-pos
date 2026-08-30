export type UUID = string

/** Todo importe es un entero en centavos. $4.200 se guarda como 420000. */
export type Centavos = number

export type MedioPago = 'efectivo' | 'transferencia' | 'qr' | 'fiado'

export interface Producto {
  id: UUID
  codigoBarras: string | null
  nombre: string
  costo: Centavos
  precio: Centavos
  stock: number
  stockMinimo: number
  actualizadoEn: number
}

/** El precio y el costo se copian al vender: si mañana sube la yerba,
 *  la ganancia de ayer no puede cambiar sola. */
export interface ItemVenta {
  productoId: UUID
  nombre: string
  cantidad: number
  precio: Centavos
  costo: Centavos
}

export interface Venta {
  id: UUID
  fecha: number
  total: Centavos
  medioPago: MedioPago
  items: ItemVenta[]
  clienteId: UUID | null
}

export interface Cliente {
  id: UUID
  nombre: string
  telefono: string | null
}

export interface Fiado {
  id: UUID
  clienteId: UUID
  ventaId: UUID | null
  monto: Centavos
  fecha: number
  vence: number | null
}

export interface FiadoPago {
  id: UUID
  fiadoId: UUID
  monto: Centavos
  fecha: number
}

export interface ItemIngreso {
  productoId: UUID
  cantidad: number
  costoUnitario: Centavos
}

/** La compra al mayorista: no se deduce de nada y fija el costo. */
export interface Ingreso {
  id: UUID
  fecha: number
  proveedor: string | null
  items: ItemIngreso[]
  origen: 'manual' | 'foto'
}

export interface Negocio {
  id: UUID
  nombre: string
  logo: string | null
  color: string | null
  /** Id en la nube; ausente mientras el negocio viva sólo en el teléfono. */
  negocioId?: UUID
  telefono?: string
}
