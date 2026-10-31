import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { encolar, haySinSubir, hayPendientes, marcarRechazado, pendientes } from '@/datos/local/cola'
import { SesionVencida, esErrorDeSesion, sincronizar } from '@/datos/nube/sincronizar'
import { bajarCambios } from '@/datos/nube/bajada'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('sesión vencida', () => {
  it('reconoce los 401 de PostgREST y el token vencido', () => {
    expect(esErrorDeSesion({ code: 'PGRST303', message: 'JWT expired' })).toBe(true)
    expect(esErrorDeSesion({ code: 'PGRST301', message: 'x' })).toBe(true)
    expect(esErrorDeSesion({ status: 401 })).toBe(true)
    expect(esErrorDeSesion({ code: '42501', message: 'permission denied for table ventas' })).toBe(false)
    expect(esErrorDeSesion(new Error('Failed to fetch'))).toBe(false)
  })

  it('no gasta intentos: corta la vuelta y la venta sigue pendiente', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await encolar('venta', 'crear', { id: 'v2' })
    const subir = vi.fn().mockRejectedValue({ code: 'PGRST303', message: 'JWT expired' })
    await expect(sincronizar(subir)).rejects.toBeInstanceOf(SesionVencida)
    expect(subir).toHaveBeenCalledTimes(1)
    const cola = await pendientes()
    expect(cola).toHaveLength(2)
    expect(cola.every((item) => item.intentos === 0)).toBe(true)
  })

  it('la bajada también avisa que la sesión venció', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'x', logo: null, color: null, negocioId: 'n-1' } as never)
    const traer = vi.fn().mockRejectedValue({ code: 'PGRST303', message: 'JWT expired' })
    await expect(bajarCambios(traer)).rejects.toBeInstanceOf(SesionVencida)
  })
})

describe('lo que no subió', () => {
  it('una venta rechazada no cuenta como pendiente pero sí como sin subir (no se borra al salir sin aviso)', async () => {
    await encolar('venta', 'crear', { id: 'v1' })
    await marcarRechazado('venta:v1', { message: 'permission denied for table ventas' })
    expect(await hayPendientes()).toBe(false)
    expect(await haySinSubir()).toBe(true)
  })
})
