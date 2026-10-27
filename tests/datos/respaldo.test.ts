import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { crearRespaldoLocal, restaurarRespaldoLocal, validarRespaldoLocal } from '@/datos/local/respaldo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('respaldo local', () => {
  it('exporta y valida todas las entidades del negocio', async () => {
    await repos.productos.guardar({ codigoBarras: '779', nombre: 'Yerba', costo: 30000, precio: 50000, stock: 2, stockMinimo: 1 })
    await db.negocio.put({ id: 'unico', nombre: 'Mi almacén', logo: null, color: null })
    const respaldo = await crearRespaldoLocal()
    expect(validarRespaldoLocal(respaldo)).toBe(true)
    expect(respaldo.productos).toHaveLength(1)
    expect(respaldo.negocio).toHaveLength(1)
    expect(respaldo.preferencias).toEqual([])
  })

  it('restaura datos y conserva el vínculo de nube del aparato actual', async () => {
    const respaldo = {
      version: 1 as const,
      creadoEn: Date.now(),
      productos: [{ id: 'p1', codigoBarras: null, nombre: 'Fideos', costo: 10000, precio: 15000, stock: 3, stockMinimo: 1, actualizadoEn: 1 }],
      ventas: [], clientes: [], fiados: [], fiadoPagos: [], ingresos: [], cierres: [],
      negocio: [{ id: 'unico', nombre: 'Respaldo', logo: null, color: '#12694E', negocioId: 'viejo' }],
    }
    await db.negocio.put({ id: 'unico', nombre: 'Actual', logo: null, color: null, negocioId: 'nuevo' })
    const cantidad = await restaurarRespaldoLocal(respaldo)
    expect(cantidad).toBe(2)
    expect((await db.productos.get('p1'))?.nombre).toBe('Fideos')
    expect((await db.negocio.get('unico'))?.negocioId).toBe('nuevo')
  })
})
