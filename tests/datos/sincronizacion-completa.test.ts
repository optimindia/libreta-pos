import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar, marcarFallido, MAX_INTENTOS, productoTieneCambiosPendientes } from '@/datos/local/cola'
import { repos } from '@/datos/local/repos'
import { bajarCambios, type TraerCambiosFn } from '@/datos/nube/bajada'
import { sumarReservas } from '@/datos/nube/reservasEnVivo'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-1', rol: 'dueno' })
})

function traerSolo(tabla: string, filas: unknown[]): TraerCambiosFn {
  return vi.fn(async (pedida: string) => (pedida === tabla ? filas : []))
}

describe('borrados en otro aparato', () => {
  it('un cliente borrado en la PC desaparece del celular, con lo que tenía en cola', async () => {
    await db.clientes.put({ id: 'k1', nombre: 'Rosa', telefono: null })
    await encolar('cliente', 'actualizar', { id: 'k1', nombre: 'Rosa', telefono: '261' })
    await bajarCambios(traerSolo('borrados', [{ tabla: 'clientes', id: 'k1', actualizadoEn: Date.now() }]))
    expect(await db.clientes.get('k1')).toBeUndefined()
    expect(await db.cola.get('cliente:k1')).toBeUndefined()
  })

  it('un movimiento de caja borrado también', async () => {
    await db.movimientosCaja.put({ id: 'm1', fecha: 1, tipo: 'salida', concepto: 'Flete', monto: 100, medioPago: 'efectivo' })
    await bajarCambios(traerSolo('borrados', [{ tabla: 'movimientos_caja', id: 'm1', actualizadoEn: Date.now() }]))
    expect(await db.movimientosCaja.get('m1')).toBeUndefined()
  })
})

describe('datos del negocio', () => {
  it('el nombre cambiado en otro aparato llega', async () => {
    await bajarCambios(traerSolo('negocios', [{ id: 'n-1', nombre: 'Lubricentro', logo: null, color: '#123456', actualizadoEn: Date.now() }]))
    expect(await db.negocio.get('unico')).toMatchObject({ nombre: 'Lubricentro', color: '#123456', negocioId: 'n-1' })
  })

  it('guardar los ajustes los encola para subir, y un cambio sin subir no lo pisa la bajada', async () => {
    await repos.negocio.guardarAjustes('Mi kiosco', null, null)
    expect((await db.cola.toArray()).some((item) => item.entidad === 'negocio')).toBe(true)
    await bajarCambios(traerSolo('negocios', [{ id: 'n-1', nombre: 'Viejo', logo: null, color: null, actualizadoEn: Date.now() }]))
    expect((await db.negocio.get('unico'))?.nombre).toBe('Mi kiosco')
  })
})

describe('stock y cola', () => {
  it('editar el stock desde la ficha viaja como un ajuste', async () => {
    const producto = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 100, precio: 200, stock: 5, stockMinimo: 0 })
    await db.cola.clear()
    await repos.productos.guardar({ ...producto, stock: 8 })
    const movimientos = (await db.cola.toArray()).filter((item) => item.entidad === 'movimientoStock')
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].datos).toMatchObject({ productoId: producto.id, cantidad: 3, origen: 'ajuste' })
  })

  it('cambiar sólo el precio no inventa movimientos de stock', async () => {
    const producto = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba', costo: 100, precio: 200, stock: 5, stockMinimo: 0 })
    await db.cola.clear()
    await repos.productos.guardar({ ...producto, precio: 250 })
    expect((await db.cola.toArray()).filter((item) => item.entidad === 'movimientoStock')).toHaveLength(0)
  })

  it('un movimiento agotado deja de frenar la bajada de ese producto', async () => {
    await encolar('movimientoStock', 'crear', { id: 'ms1', productoId: 'p1', cantidad: -1, origen: 'venta' })
    expect(await productoTieneCambiosPendientes('p1')).toBe(true)
    for (let i = 0; i < MAX_INTENTOS; i++) await marcarFallido('movimientoStock:ms1', new Error('stock insuficiente'))
    expect(await productoTieneCambiosPendientes('p1')).toBe(false)
  })
})

describe('ajustes del negocio', () => {
  it('las metas y la leyenda se guardan en las preferencias que viajan', async () => {
    await repos.preferencias.guardarAjustes({ metaPlata: '50000', leyendaTicket: 'Gracias, vuelva' })
    const preferencias = await db.preferencias.get('unico')
    expect(preferencias?.ajustes).toEqual({ metaPlata: '50000', leyendaTicket: 'Gracias, vuelva' })
    expect(await db.cola.get('preferencias:unico')).toBeTruthy()
  })

  it('cambiar una función no borra los ajustes', async () => {
    await repos.preferencias.guardarAjustes({ metaPro: '80000' })
    await repos.preferencias.guardarFunciones({})
    expect((await db.preferencias.get('unico'))?.ajustes).toEqual({ metaPro: '80000' })
  })
})

describe('reservas en vivo', () => {
  it('suma lo de los otros aparatos y no cuenta el propio', () => {
    const total = sumarReservas({
      yo: [{ items: { p1: 5 } }],
      pc: [{ items: { p1: 1, p2: 0.5 } }],
      celu: [{ items: { p1: 2 } }],
    }, 'yo')
    expect(total.get('p1')).toBe(3)
    expect(total.get('p2')).toBe(0.5)
  })

  it('un aparato con dos pestañas no cuenta dos veces la misma venta', () => {
    const total = sumarReservas({ pc: [{ items: { p1: 2 } }, { items: { p1: 2 } }] }, 'yo')
    expect(total.get('p1')).toBe(2)
  })
})
