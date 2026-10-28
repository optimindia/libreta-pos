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
}

const FECHAS = new Set(['fecha', 'vence', 'anulado_en', 'actualizado_en', 'oferta_hasta', 'eliminado_en', 'fecha_entrega'])

const INVERSO: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPOS).map(([local, nube]) => [nube, local]),
)

function aFilaPlana(datos: Fila, negocioId: UUID, incluirMarca = false): Fila {
  const fila: Fila = { negocio_id: negocioId }
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'items' || (!incluirMarca && clave === 'actualizadoEn') || clave === 'categoria' || clave === 'favorito' || clave === 'limiteFiado') continue
    const nombre = CAMPOS[clave] ?? clave
    const valorFinal = valor === undefined && (clave === 'precioOferta' || clave === 'ofertaHasta') ? null : valor
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

  const cabecera = aFilaPlana(objeto, negocioId)

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

export function deLaNube(tabla: string, fila: Fila): Fila {
  const local: Fila = {}
  for (const [clave, valor] of Object.entries(fila)) {
    if (clave === 'negocio_id') continue
    const nombre = INVERSO[clave] ?? clave
    local[nombre] =
      FECHAS.has(clave) && typeof valor === 'string'
        ? new Date(valor).getTime()
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
  }
}
