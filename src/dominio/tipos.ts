import type { FuncionesNegocio } from './funciones'

export type UUID = string

/** Todo importe es un entero en centavos. $4.200 se guarda como 420000. */
export type Centavos = number

export type MedioPago = 'efectivo' | 'transferencia' | 'qr' | 'fiado'

export type EstadoVenta = 'completada' | 'anulada'
export type EstadoCobro = 'confirmado' | 'pendiente'
export type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
export type TipoEntrega = 'retiro' | 'envio'
export type EstadoSuscripcion = 'prueba' | 'activa' | 'gracia' | 'suspendida'
export type TipoSuscripcion = 'prueba' | 'mensual' | 'cortesia' | 'manual'

export type MedioCaja = Exclude<MedioPago, 'fiado'>
export type TipoMovimientoCaja = 'entrada' | 'salida'

export interface Producto {
  id: UUID
  codigoBarras: string | null
  nombre: string
  costo: Centavos
  precio: Centavos
  stock: number
  stockMinimo: number
  actualizadoEn: number
  /** Preferencias locales del catálogo; no alteran los totales históricos. */
  categoria?: string
  favorito?: boolean
  /** Precio promocional opcional. El precio histórico de una venta nunca cambia. */
  precioOferta?: Centavos
  ofertaHasta?: number
  /** Marca interna para propagar un borrado entre dispositivos sin romper
   *  el historial remoto. La app nunca muestra productos marcados. */
  eliminadoEn?: number
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
  /** Las ventas antiguas no traen estado: se consideran completadas. */
  estado?: EstadoVenta
  anuladaEn?: number
  motivoAnulacion?: string
  /** Ayuda a no aceptar una transferencia/QR sin mirar la billetera. */
  estadoCobro?: EstadoCobro
  referenciaPago?: string
  pedidoId?: UUID
}

export interface ItemPedido {
  productoId: UUID
  nombre: string
  cantidad: number
  precio: Centavos
  costo: Centavos
}

/** Pedido/reserva de un cliente. No descuenta stock hasta convertirse en venta;
 * cuando reservarStock está activo, sí bloquea esas unidades para evitar
 * prometer la misma mercadería dos veces. */
export interface Pedido {
  id: UUID
  fecha: number
  actualizadoEn: number
  estado: EstadoPedido
  clienteId: UUID | null
  items: ItemPedido[]
  total: Centavos
  tipoEntrega: TipoEntrega
  fechaEntrega: number | null
  direccion: string | null
  nota: string | null
  reservarStock: boolean
  ventaId?: UUID
}

export interface Cliente {
  id: UUID
  nombre: string
  telefono: string | null
  /** Límite opcional para alertar antes de seguir fiando. */
  limiteFiado?: Centavos
}

export interface Fiado {
  id: UUID
  clienteId: UUID
  ventaId: UUID | null
  monto: Centavos
  fecha: number
  vence: number | null
  /** Una deuda anulada conserva su trazabilidad, pero ya no suma al saldo. */
  anuladoEn?: number
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

/** El arqueo de caja: se guarda el hecho de haber cerrado, con los números
 *  de ese momento. El esperado siempre se puede recalcular desde las ventas. */
export interface Cierre {
  id: UUID
  fecha: number
  fondoInicial: Centavos
  ventasEfectivo: Centavos
  pagosFiadoEfectivo: Centavos
  esperado: Centavos
  contado: Centavos
  entradasCaja?: Centavos
  salidasCaja?: Centavos
}

/** Movimiento manual del cajón; no es una venta ni un gasto contable. */
export interface MovimientoCaja {
  id: UUID
  fecha: number
  tipo: TipoMovimientoCaja
  concepto: string
  monto: Centavos
  medioPago: MedioCaja
  /** Marca de servidor para sincronización incremental entre aparatos. */
  actualizadoEn?: number
}

export interface Negocio {
  id: UUID
  nombre: string
  logo: string | null
  color: string | null
  /** Id en la nube; ausente mientras el negocio viva sólo en el teléfono. */
  negocioId?: UUID
  telefono?: string
  usuarioId?: UUID
  /** Marca de la última bajada incremental; el reloj es el del servidor. */
  ultimaBajada?: number
  /** Entitlement cacheado sólo para explicar el estado mientras se verifica.
   *  Nunca concede acceso SaaS sin confirmación fresca del servidor. */
  suscripcionEstado?: EstadoSuscripcion
  suscripcionTipo?: TipoSuscripcion
  suscripcionVenceEn?: number
  suscripcionGraciaHasta?: number
  suscripcionActualizadaEn?: number
}

/** Preferencias compartidas del negocio. Se guarda en una tabla propia para
 * no dar al cliente permisos de escritura sobre los datos administrativos de
 * `negocios`. */
export interface PreferenciasNegocio {
  id: 'unico'
  negocioId?: UUID
  funciones: FuncionesNegocio
  actualizadoEn: number
}
