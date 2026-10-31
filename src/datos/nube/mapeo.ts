import type { EnCola } from '@/datos/local/db'
import type { UUID } from '@/dominio/tipos'
import { normalizarFunciones } from '@/dominio/funciones'

export type Fila = Record<string, unknown>

export interface ParteASubir {
  tabla: string
  filas: Fila[]
}

/** Adentro los nombres son en camelCase y las fechas números; en Postgres
 *  son snake_case y textos ISO. Toda la traducción vive acá y en un solo
 *  lugar, para que un cambio de esquema no haya que perseguirlo por la app. */
const CAMPOS: Record<string, string> = {
  codigoBarras: 'codigo_barras',
  negocioId: 'negocio_id',
  stockMinimo: 'stock_minimo',
  actualizadoEn: 'actualizado_en',
  precioOferta: 'precio_oferta',
  ofertaHasta: 'oferta_hasta',
  eliminadoEn: 'eliminado_en',
  medioPago: 'medio_pago',
  estadoCobro: 'estado_cobro',
  referenciaPago: 'referencia_pago',
  clienteId: 'cliente_id',
  ventaId: 'venta_id',
  fiadoId: 'fiado_id',
  anuladoEn: 'anulado_en',
  productoId: 'producto_id',
  costoUnitario: 'costo_unitario',
  fondoInicial: 'fondo_inicial',
  ventasEfectivo: 'ventas_efectivo',
  pagosFiadoEfectivo: 'pagos_fiado_efectivo',
  pedidoId: 'pedido_id',
  fechaEntrega: 'fecha_entrega',
  tipoEntrega: 'tipo_entrega',
  reservarStock: 'reservar_stock',
  vendidoPor: 'vendido_por',
  usuarioId: 'usuario_id',
  anuladaEn: 'anulada_en',
  motivoAnulacion: 'motivo_anulacion',
  limiteFiado: 'limite_fiado',
  entradasCaja: 'entradas_caja',
  salidasCaja: 'salidas_caja',
}

const FECHAS = new Set(['fecha', 'vence', 'anulado_en', 'anulada_en', 'actualizado_en', 'oferta_hasta', 'eliminado_en', 'fecha_entrega'])

const INVERSO: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPOS).map(([local, nube]) => [nube, local]),
)

/** Un opcional que se borra (quitar la categoría, la oferta o el límite)
 *  tiene que viajar como null: un undefined desaparece del JSON y la nube se
 *  quedaría con el valor viejo. */
const BORRABLES = new Set(['precioOferta', 'ofertaHasta', 'categoria', 'limiteFiado'])

/** Lo que no se manda queda como estaba en la nube: estas claves se fuerzan
 *  para que "sin categoría" o "sin límite" también lleguen a los demás. */
const SIEMPRE: Record<string, Record<string, unknown>> = {
  producto: { categoria: null, favorito: false },
  cliente: { limiteFiado: null },
}

function aFilaPlana(datos: Fila, negocioId: UUID, incluirMarca = false): Fila {
  const fila: Fila = { negocio_id: negocioId }
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'items' || (!incluirMarca && clave === 'actualizadoEn')) continue
    const nombre = CAMPOS[clave] ?? clave
    const valorFinal = valor === undefined && BORRABLES.has(clave) ? null : valor
    fila[nombre] =
      FECHAS.has(nombre) && typeof valorFinal === 'number'
        ? new Date(valorFinal).toISOString()
        : valorFinal
  }
  return fila
}

export function aLaNube(
  entidad: EnCola['entidad'],
  datos: unknown,
  negocioId: UUID,
): ParteASubir[] {
  const objeto = datos as Fila

  if (entidad === 'preferencias') {
    const fila = aFilaPlana(objeto, negocioId, true)
    delete fila.id
    fila.negocio_id = negocioId
    return [{ tabla: 'negocio_configuracion', filas: [fila] }]
  }

  const cabecera = aFilaPlana({ ...(SIEMPRE[entidad] ?? {}), ...objeto }, negocioId)

  if (entidad === 'venta' || entidad === 'ingreso' || entidad === 'pedido') {
    const tablaCabecera = entidad === 'venta' ? 'ventas' : entidad === 'ingreso' ? 'ingresos' : 'pedidos'
    const tablaItems = entidad === 'venta' ? 'venta_items' : entidad === 'ingreso' ? 'ingreso_items' : 'pedido_items'
    const claveDelPadre = entidad === 'venta' ? 'venta_id' : entidad === 'ingreso' ? 'ingreso_id' : 'pedido_id'

    const items = (objeto.items as Fila[] | undefined) ?? []
    const partes: ParteASubir[] = [{ tabla: tablaCabecera, filas: [cabecera] }]

    if (items.length > 0) {
      partes.push({
        tabla: tablaItems,
        // La posición identifica el renglón: subir dos veces la misma venta
        // actualiza los mismos renglones en vez de duplicarlos.
        filas: items.map((item, posicion) => ({
          ...aFilaPlana(item, negocioId),
          [claveDelPadre]: objeto.id,
          posicion,
        })),
      })
    }
    return partes
  }

  const TABLA: Record<string, string> = {
    producto: 'productos',
    cliente: 'clientes',
    fiado: 'fiados',
    fiadoPago: 'fiado_pagos',
    cierre: 'cierres',
    movimientoCaja: 'movimientos_caja',
    pedido: 'pedidos',
  }
  return [{ tabla: TABLA[entidad], filas: [cabecera] }]
}

/** Columnas numeric (cantidades con decimales): según el cliente, Postgres
 *  puede devolverlas como texto ("0.500"). Adentro siempre son números. */
const CANTIDADES = new Set(['stock', 'stock_minimo', 'cantidad'])

/** En la app un opcional vacío es "no está", no null. */
const OPCIONALES = new Set(['categoria', 'limite_fiado', 'precio_oferta', 'oferta_hasta', 'anulada_en', 'motivo_anulacion', 'entradas_caja', 'salidas_caja'])

export function deLaNube(tabla: string, fila: Fila): Fila {
  const local: Fila = {}
  for (const [clave, valor] of Object.entries(fila)) {
    if (clave === 'negocio_id') continue
    if (valor === null && OPCIONALES.has(clave)) continue
    const nombre = INVERSO[clave] ?? clave
    local[nombre] =
      FECHAS.has(clave) && typeof valor === 'string'
        ? new Date(valor).getTime()
        : CANTIDADES.has(clave) && typeof valor === 'string'
          ? Number(valor)
          : valor
  }
  return local
}

export function preferenciasDeLaNube(fila: Fila): Fila {
  const local = deLaNube('negocio_configuracion', fila)
  return {
    ...local,
    id: 'unico',
    negocioId: fila.negocio_id,
    funciones: normalizarFunciones(local.funciones),
    ajustes: typeof local.ajustes === 'object' && local.ajustes !== null ? local.ajustes : {},
  }
}
