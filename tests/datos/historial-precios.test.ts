import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { historialConCambio, MAXIMO_CAMBIOS, resumenHistorial } from '@/dominio/historialPrecios'
import { aLaNube } from '@/datos/nube/mapeo'
import type { Producto } from '@/dominio/tipos'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('historial de precios', () => {
  it('un producto nuevo no tiene historial; el primer cambio guarda cómo estaba y cómo quedó', async () => {
    const yerba = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 5, stockMinimo: 1 })
    expect(yerba.historialPrecios).toBeUndefined()
    const subida = await repos.productos.guardar({ ...yerba, precio: 480000 })
    expect(subida.historialPrecios?.map((cambio) => cambio.precio)).toEqual([420000, 480000])
    const otra = await repos.productos.guardar({ ...subida, nombre: 'Yerba Playadito' })
    expect(otra.historialPrecios).toHaveLength(2)
    expect(resumenHistorial(otra).subioDesdeElPrimero).toBeCloseTo(14.3)
  })

  it('un ingreso con costo nuevo también queda anotado', async () => {
    const yerba = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 5, stockMinimo: 1 })
    await repos.ingresos.registrar({ proveedor: 'Norte', origen: 'manual', items: [{ productoId: yerba.id, cantidad: 6, costoUnitario: 330000 }] })
    const despues = await db.productos.get(yerba.id)
    expect(despues?.historialPrecios?.map((cambio) => cambio.costo)).toEqual([300000, 330000])
  })

  it('no guarda más de MAXIMO_CAMBIOS entradas', () => {
    let producto = { id: 'p', codigoBarras: null, nombre: 'X', costo: 1, precio: 100, stock: 0, stockMinimo: 0 } as Producto
    for (let i = 1; i <= MAXIMO_CAMBIOS + 10; i++) {
      const nuevo = { ...producto, precio: 100 + i }
      nuevo.historialPrecios = historialConCambio(producto, nuevo, i)
      producto = nuevo
    }
    expect(producto.historialPrecios).toHaveLength(MAXIMO_CAMBIOS)
    expect(producto.historialPrecios?.at(-1)?.precio).toBe(100 + MAXIMO_CAMBIOS + 10)
  })

  it('viaja a la nube como historial_precios', () => {
    const partes = aLaNube('producto', { id: 'p', nombre: 'X', historialPrecios: [{ fecha: 1, precio: 2, costo: 1 }] }, 'n-1')
    const fila = partes.flatMap((parte) => parte.filas)[0]
    expect(fila.historial_precios).toEqual([{ fecha: 1, precio: 2, costo: 1 }])
  })
})
