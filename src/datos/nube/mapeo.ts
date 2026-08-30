import type { EnCola } from '@/datos/local/db'
import type { UUID } from '@/dominio/tipos'

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
  stockMinimo: 'stock_minimo',
  actualizadoEn: 'actualizado_en',
  medioPago: 'medio_pago',
  clienteId: 'cliente_id',
  ventaId: 'venta_id',
  fiadoId: 'fiado_id',
  productoId: 'producto_id',
  costoUnitario: 'costo_unitario',
}

const FECHAS = new Set(['fecha', 'vence', 'actualizado_en'])

const INVERSO: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPOS).map(([local, nube]) => [nube, local]),
)

function aFilaPlana(datos: Fila, negocioId: UUID): Fila {
  const fila: Fila = { negocio_id: negocioId }
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'items') continue
    const nombre = CAMPOS[clave] ?? clave
    fila[nombre] =
      FECHAS.has(nombre) && typeof valor === 'number'
        ? new Date(valor).toISOString()
        : valor
  }
  return fila
}

export function aLaNube(
  entidad: EnCola['entidad'],
  datos: unknown,
  negocioId: UUID,
): ParteASubir[] {
  const objeto = datos as Fila
  const cabecera = aFilaPlana(objeto, negocioId)

  if (entidad === 'venta' || entidad === 'ingreso') {
    const tablaCabecera = entidad === 'venta' ? 'ventas' : 'ingresos'
    const tablaItems = entidad === 'venta' ? 'venta_items' : 'ingreso_items'
    const claveDelPadre = entidad === 'venta' ? 'venta_id' : 'ingreso_id'

    const items = (objeto.items as Fila[] | undefined) ?? []
    const partes: ParteASubir[] = [{ tabla: tablaCabecera, filas: [cabecera] }]

    if (items.length > 0) {
      partes.push({
        tabla: tablaItems,
        filas: items.map((item) => ({
          ...aFilaPlana(item, negocioId),
          [claveDelPadre]: objeto.id,
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
