import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { estadoFidelidad, normalizarFidelidad, type ConfigFidelidad } from '@/dominio/fidelidad'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { aLaNube } from '@/datos/nube/mapeo'
import type { Venta } from '@/dominio/tipos'

const config: ConfigFidelidad = { activa: true, cadaCompras: 3, minimo: 50000, premio: { tipo: 'porcentaje', valor: 10 } }
const v = (id: string, total: number, extra: Partial<Venta> = {}): Venta => ({ id, fecha: 1, total, medioPago: 'efectivo', clienteId: 'c', items: [], ...extra })

describe('la décima gratis', () => {
  it('suma un sello por compra desde el mínimo y da premio cada N', () => {
    const e = estadoFidelidad([v('1', 60000), v('2', 10000), v('3', 70000), v('4', 80000), v('5', 90000, { estado: 'anulada' })], 'c', config)
    expect(e).toMatchObject({ premios: 1, sellos: 0, faltan: 3 })
  })

  it('usar el premio lo descuenta y esa compra no suma sello', () => {
    const e = estadoFidelidad([v('1', 60000), v('2', 60000), v('3', 60000), v('4', 60000, { canjeFidelidad: true }), v('5', 60000)], 'c', config)
    expect(e).toMatchObject({ premios: 0, sellos: 1, faltan: 2 })
  })

  it('valida la configuración', () => {
    expect(normalizarFidelidad({ ...config, cadaCompras: 1 })).toBeUndefined()
    expect(normalizarFidelidad({ ...config, premio: { tipo: 'porcentaje', valor: 150 } })).toBeUndefined()
    expect(normalizarFidelidad(config)).toEqual(config)
  })
})

describe('venta con cliente y canje', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  it('registra el canje sólo si hay cliente y viaja a la nube', async () => {
    const yerba = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 1, precio: 100000, stock: 5, stockMinimo: 0 })
    const items = [{ productoId: yerba.id, nombre: 'Yerba', cantidad: 1, precio: 100000, costo: 1 }]
    const conCliente = await repos.ventas.registrar({ items, medioPago: 'efectivo', clienteId: 'c', canjeFidelidad: true })
    expect(conCliente.canjeFidelidad).toBe(true)
    const sinCliente = await repos.ventas.registrar({ items, medioPago: 'efectivo', clienteId: null, canjeFidelidad: true })
    expect(sinCliente.canjeFidelidad).toBeUndefined()
    const [parte] = aLaNube('venta', conCliente, 'n-1')
    expect(parte.filas[0].canje_fidelidad).toBe(true)
  })
})
