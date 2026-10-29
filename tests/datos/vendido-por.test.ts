import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'
import type { ItemVenta } from '@/dominio/tipos'

const item = (): ItemVenta => ({ productoId: 'p1', nombre: 'Yerba', cantidad: 1, precio: 420000, costo: 300000 })

async function conStock() {
  return repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000, stock: 10, stockMinimo: 1 })
}

const comoVendedor = () =>
  db.negocio.put({ id: 'unico', nombre: 'A', logo: null, color: null, negocioId: 'n', usuarioId: 'u-7', rol: 'vendedor' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Dexie v6: la migración no pierde datos', () => {
  it('abre una base v5 con ventas, pagos y cierres viejos y los conserva', async () => {
    db.close()
    await Dexie.delete('libreta')
    const vieja = new Dexie('libreta')
    vieja.version(1).stores({
      productos: 'id, codigoBarras, nombre', ventas: 'id, fecha', clientes: 'id, nombre', fiados: 'id, clienteId, fecha',
      fiadoPagos: 'id, fiadoId', ingresos: 'id, fecha', negocio: 'id', cola: 'id, creadoEn',
    })
    vieja.version(2).stores({ cierres: 'id, fecha' })
    vieja.version(3).stores({ movimientosCaja: 'id, fecha, tipo, medioPago' })
    vieja.version(4).stores({ pedidos: 'id, fecha, estado, clienteId, fechaEntrega, actualizadoEn' })
    vieja.version(5).stores({ preferencias: 'id, negocioId, actualizadoEn' })
    await vieja.open()
    await vieja.table('ventas').put({ id: 'v1', fecha: 1, total: 100, medioPago: 'efectivo', items: [], clienteId: null })
    await vieja.table('fiadoPagos').put({ id: 'p1', fiadoId: 'f', monto: 5, fecha: 1 })
    await vieja.table('cierres').put({ id: 'c1', fecha: 1, fondoInicial: 0, ventasEfectivo: 0, pagosFiadoEfectivo: 0, esperado: 0, contado: 0 })
    vieja.close()

    await db.open()
    expect((await db.ventas.get('v1'))?.total).toBe(100)
    expect((await db.ventas.get('v1'))?.vendidoPor).toBeUndefined()
    expect(await db.fiadoPagos.count()).toBe(1)
    expect(await db.cierres.count()).toBe(1)
    expect(db.verno).toBeGreaterThanOrEqual(6)
    expect(await db.ventas.where('vendidoPor').equals('x').count()).toBe(0)
  })
})

describe('registrar quién hizo cada cosa', () => {
  it('la venta lleva el usuario del aparato', async () => {
    await comoVendedor()
    const p = await conStock()
    const venta = await repos.ventas.registrar({ items: [{ ...item(), productoId: p.id }], medioPago: 'efectivo', clienteId: null })
    expect(venta.vendidoPor).toBe('u-7')
    expect((await db.ventas.get(venta.id))?.vendidoPor).toBe('u-7')
    const enCola = await db.cola.get(`venta:${venta.id}`)
    expect((enCola?.datos as { vendidoPor?: string }).vendidoPor).toBe('u-7')
  })

  it('sin usuario (aparato sólo local) no agrega la clave', async () => {
    const p = await conStock()
    const venta = await repos.ventas.registrar({ items: [{ ...item(), productoId: p.id }], medioPago: 'efectivo', clienteId: null })
    expect('vendidoPor' in venta).toBe(false)
  })

  it('el pago de fiado y el cierre también', async () => {
    await comoVendedor()
    const cli = await repos.clientes.guardar({ nombre: 'Ana', telefono: null })
    const fiado = await repos.fiados.anotar({ clienteId: cli.id, ventaId: null, monto: 1000, vence: null })
    await repos.fiados.pagar(fiado.id, 400)
    expect((await db.fiadoPagos.toArray())[0].usuarioId).toBe('u-7')
    const c = await repos.cierres.registrar({ fondoInicial: 0, ventasEfectivo: 0, pagosFiadoEfectivo: 0, esperado: 0, contado: 0 })
    expect(c.usuarioId).toBe('u-7')
  })

  it('un cierre de turno no cuenta como "último cierre" del día del dueño', async () => {
    await comoVendedor()
    const dueno = await repos.cierres.registrar({ fondoInicial: 0, ventasEfectivo: 0, pagosFiadoEfectivo: 0, esperado: 0, contado: 500 })
    const turno = await repos.cierres.registrarTurno({ ventasEfectivo: 100, pagosFiadoEfectivo: 0, esperado: 100, contado: 90 })
    expect(turno.alcance).toBe('turno')
    expect(turno.fondoInicial).toBe(0)
    expect((await repos.cierres.ultimo())?.id).toBe(dueno.id)
    expect((await repos.cierres.todos()).map((x) => x.id)).toEqual([dueno.id])
    expect((await repos.cierres.turnos()).map((x) => x.id)).toEqual([turno.id])
    expect(turno.fecha).toBeGreaterThan(dueno.fecha)
  })
})

describe('mapeo a Supabase', () => {
  it('vendidoPor, usuarioId y alcance viajan en snake_case', () => {
    const [v] = aLaNube('venta', { id: 'v', fecha: 1, total: 1, medioPago: 'efectivo', items: [], clienteId: null, vendidoPor: 'u1' }, 'n')
    expect(v.filas[0].vendido_por).toBe('u1')
    const [c] = aLaNube('cierre', { id: 'c', fecha: 1, usuarioId: 'u1', alcance: 'turno' }, 'n')
    expect(c.filas[0]).toMatchObject({ usuario_id: 'u1', alcance: 'turno' })
    const [p] = aLaNube('fiadoPago', { id: 'p', usuarioId: 'u1' }, 'n')
    expect(p.filas[0].usuario_id).toBe('u1')
  })
  it('lo viejo baja con null y queda "sin dato"', () => {
    expect(deLaNube('ventas', { id: 'v', vendido_por: null, negocio_id: 'n' })).toMatchObject({ vendidoPor: null })
    expect(deLaNube('ventas', { id: 'v', vendido_por: 'u1', negocio_id: 'n' })).toMatchObject({ vendidoPor: 'u1' })
  })
})
