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

/** Cómo se vende un producto: por unidad, por kilo o por litro. */
export type UnidadVenta = 'unidad' | 'kg' | 'l'

export interface Producto {
  id: UUID
  codigoBarras: string | null
  nombre: string
  costo: Centavos
  precio: Centavos
  stock: number
  stockMinimo: number
  actualizadoEn: number
  /** Por unidad (si falta), por kilo o por litro. En kilo y litro el precio,
   *  el stock y las cantidades se cuentan en esa unidad, con decimales. */
  unidad?: UnidadVenta
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
  /** Quién cobró (id de usuario). Las ventas viejas no lo traen: "Sin dato". */
  vendidoPor?: UUID | null
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
  /** Quién cobró el pago. Opcional: los pagos viejos no lo traen. */
  usuarioId?: UUID | null
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
  /** Quién hizo el cierre. Opcional: los cierres viejos no lo traen. */
  usuarioId?: UUID | null
  /** 'turno' es el cierre de un vendedor (sólo sus ventas, sin fondo ni
   *  movimientos manuales). Ausente o 'caja' es el cierre del día del dueño. */
  alcance?: 'turno' | 'caja' | null
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
  /** Rol de quien usa este aparato: 'vendedor' ve una app recortada. */
  rol?: 'dueno' | 'vendedor'
  /** Última vez que el servidor confirmó el acceso (reloj del aparato). */
  verificadoEn?: number
  /** Nombre del vendedor (el dueño no lo necesita). */
  nombreUsuario?: string | null
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
/** Ajustes del negocio que ven todos los aparatos (metas y ticket). Lo que
 *  depende del aparato (ancho del papel, tema, menú) no va acá. */
export interface AjustesNegocio {
  /** Meta de ventas por día en Plata, en pesos tal como se escribió. */
  metaPlata?: string
  /** Meta diaria del Control Pro, en pesos. */
  metaPro?: string
  /** Frase al pie del ticket impreso. */
  leyendaTicket?: string
}

export interface PreferenciasNegocio {
  id: 'unico'
  negocioId?: UUID
  funciones: FuncionesNegocio
  ajustes?: AjustesNegocio
  actualizadoEn: number
}
