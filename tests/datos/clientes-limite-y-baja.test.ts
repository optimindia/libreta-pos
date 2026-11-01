import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar } from '@/datos/local/cola'
import { ErrorClienteConDeuda, repos } from '@/datos/local/repos'
import { bajarCambios, type TraerCambiosFn } from '@/datos/nube/bajada'
import { aLaNube } from '@/datos/nube/mapeo'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n-1', usuarioId: 'u-1', rol: 'dueno' })
})

function traerClientes(filas: unknown[]): TraerCambiosFn {
  return vi.fn(async (tabla: string) => (tabla === 'clientes' ? filas : []))
}

describe('límite de fiado', () => {
  it('una bajada que trae el cliente sin límite no pisa el límite que se está subiendo', async () => {
    await db.clientes.put({ id: 'k1', nombre: 'Rosa', telefono: null, limiteFiado: 5000 })
    await encolar('cliente', 'actualizar', { id: 'k1', nombre: 'Rosa', telefono: null, limiteFiado: 5000 })
    await bajarCambios(traerClientes([{ id: 'k1', nombre: 'Rosa', telefono: null, actualizadoEn: Date.now() }]))
    expect((await db.clientes.get('k1'))?.limiteFiado).toBe(5000)
  })

  it('una vez subido, la nube es la que manda: si quitaron el límite en otro aparato, se quita', async () => {
    await db.clientes.put({ id: 'k1', nombre: 'Rosa', telefono: null, limiteFiado: 5000 })
    await bajarCambios(traerClientes([{ id: 'k1', nombre: 'Rosa', telefono: null, actualizadoEn: Date.now() }]))
    expect((await db.clientes.get('k1'))?.limiteFiado).toBeUndefined()
  })

  it('el límite viaja a la nube (antes se salteaba)', () => {
    const [{ filas }] = aLaNube('cliente', { id: 'k1', nombre: 'Rosa', telefono: null, limiteFiado: 5000 }, 'n-1')
    expect(filas[0]).toMatchObject({ limite_fiado: 5000 })
  })
})

describe('quitar un cliente', () => {
  it('no deja quitarlo si todavía debe plata', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
    await expect(repos.clientes.eliminar(cliente.id)).rejects.toBeInstanceOf(ErrorClienteConDeuda)
    expect((await repos.clientes.todos()).map((c) => c.id)).toContain(cliente.id)
  })

  it('un cliente con historial (ventas y fiados pagados) se quita de la cartera y el historial queda', async () => {
    const cliente = await repos.clientes.guardar({ nombre: 'Marta', telefono: null })
    const fiado = await repos.fiados.anotar({ clienteId: cliente.id, ventaId: null, monto: 500000, vence: null })
    await repos.fiados.pagar(fiado.id, 500000)
    await db.ventas.put({ id: 'v1', fecha: Date.now(), total: 100, medioPago: 'efectivo', items: [], clienteId: cliente.id, estado: 'completada' })

    await expect(repos.clientes.eliminar(cliente.id)).resolves.toBe(true)
    expect((await repos.clientes.todos()).map((c) => c.id)).not.toContain(cliente.id)
    expect((await db.clientes.get(cliente.id))?.eliminadoEn).toBeDefined()
    expect(await db.ventas.get('v1')).toBeDefined()
    const cola = await db.cola.get(`cliente:${cliente.id}`)
    expect(cola).toMatchObject({ operacion: 'eliminar', datos: { id: cliente.id } })
  })

  it('una baja hecha en otro aparato saca al cliente de la lista de este', async () => {
    await db.clientes.put({ id: 'k1', nombre: 'Rosa', telefono: null })
    await bajarCambios(traerClientes([{ id: 'k1', nombre: 'Rosa', telefono: null, eliminadoEn: Date.now(), actualizadoEn: Date.now() }]))
    expect((await repos.clientes.todos()).map((c) => c.id)).not.toContain('k1')
  })
})
