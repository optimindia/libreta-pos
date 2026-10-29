import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { crearRespaldoLocal, restaurarRespaldoLocal, validarRespaldoLocal } from '@/datos/local/respaldo'
import { interpretarCopia } from '@/dominio/copia'

const vacia = { esquema: 6, creadoEn: 1, productos: [], ventas: [], clientes: [], fiados: [], fiadoPagos: [], ingresos: [], cierres: [], negocio: [] }

describe('respaldo v2: round-trip y cola de sync', () => {
  it('la copia lleva versión y esquema, y no incluye la cola', async () => {
    await db.cola.put({ id: 'producto:x', entidad: 'producto', operacion: 'crear', datos: { id: 'x' }, intentos: 0, creadoEn: 1 })
    const respaldo = await crearRespaldoLocal()
    expect(respaldo.version).toBe(2)
    expect(respaldo.esquema).toBe(db.verno)
    expect(JSON.stringify(respaldo)).not.toContain('producto:x')
  })

  it('backup -> base vacía -> restore devuelve los mismos datos', async () => {
    const p = await repos.productos.guardar({ codigoBarras: '1', nombre: 'Yerba', costo: 100, precio: 200, stock: 3, stockMinimo: 1 })
    await db.negocio.put({ id: 'unico', nombre: 'Mi almacén', logo: null, color: '#112233' })
    const texto = JSON.stringify(await crearRespaldoLocal())
    await db.delete()
    await db.open()
    const leido = interpretarCopia(texto)
    expect(leido.ok).toBe(true)
    if (!leido.ok) return
    await restaurarRespaldoLocal(leido.copia)
    expect((await db.productos.get(p.id))?.nombre).toBe('Yerba')
    expect((await db.negocio.get('unico'))?.color).toBe('#112233')
  })

  it('restaurar no toca la cola ni pisa un dato más nuevo del aparato', async () => {
    await db.productos.put({ id: 'p1', codigoBarras: null, nombre: 'Del aparato', costo: 1, precio: 2, stock: 9, stockMinimo: 0, actualizadoEn: 100 })
    await db.cola.put({ id: 'producto:p1', entidad: 'producto', operacion: 'actualizar', datos: { id: 'p1' }, intentos: 2, creadoEn: 5 })
    await restaurarRespaldoLocal({
      ...vacia, version: 2,
      productos: [{ id: 'p1', codigoBarras: null, nombre: 'Viejo', costo: 1, precio: 2, stock: 1, stockMinimo: 0, actualizadoEn: 50 }],
    })
    expect((await db.productos.get('p1'))?.nombre).toBe('Del aparato')
    expect(await db.cola.toArray()).toEqual([expect.objectContaining({ id: 'producto:p1', intentos: 2 })])
  })

  it('sin reemplazo no borra; con reemplazo borra lo que la copia no trae, pero nunca la cola', async () => {
    await db.productos.put({ id: 'solo-aca', codigoBarras: null, nombre: 'Local', costo: 1, precio: 2, stock: 1, stockMinimo: 0, actualizadoEn: 1 })
    await db.cola.put({ id: 'producto:solo-aca', entidad: 'producto', operacion: 'crear', datos: { id: 'solo-aca' }, intentos: 0, creadoEn: 5 })
    await restaurarRespaldoLocal({ ...vacia, version: 2 })
    expect(await db.productos.count()).toBe(1)
    await restaurarRespaldoLocal({ ...vacia, version: 2 }, { reemplazar: true })
    expect(await db.productos.count()).toBe(0)
    expect(await db.cola.count()).toBe(1)
  })

  it('no pisa el rol ni el vínculo del aparato con el de la copia', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Actual', logo: null, color: null, negocioId: 'n', rol: 'vendedor', usuarioId: 'u' })
    await restaurarRespaldoLocal({
      ...vacia, version: 2,
      negocio: [{ id: 'unico', nombre: 'Copia', logo: null, color: '#fff', rol: 'dueno', negocioId: 'otro' }],
    })
    expect(await db.negocio.get('unico')).toMatchObject({ nombre: 'Copia', rol: 'vendedor', negocioId: 'n', usuarioId: 'u' })
  })

  it('una copia corrupta o de versión futura no se restaura', async () => {
    expect(interpretarCopia('{{{').ok).toBe(false)
    expect(interpretarCopia(JSON.stringify({ version: 99, creadoEn: 1 }))).toMatchObject({ ok: false, motivo: 'version-futura' })
    await expect(restaurarRespaldoLocal({ version: 99 } as never)).rejects.toThrow()
  })
})

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
