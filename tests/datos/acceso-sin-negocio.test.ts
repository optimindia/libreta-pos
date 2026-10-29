import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'

type Resp = { data: unknown; error: unknown }
let sesion: { data: { session: { user: { id: string } } | null }; error?: { name: string } }
let vinculo: Resp
let negocioRemoto: Resp

vi.mock('@/datos/nube/cliente', () => ({
  nubeActiva: () => true,
  cliente: {
    auth: { getSession: async () => sesion },
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (tabla === 'usuarios_negocio') return vinculo
            if (tabla === 'negocios') return negocioRemoto
            return { data: null, error: null }
          },
        }),
      }),
    }),
  },
}))

import { cargarEstadoAcceso } from '@/datos/nube/acceso'

async function sembrarNegocioLocal() {
  await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, negocioId: 'n1', usuarioId: 'u1', rol: 'vendedor' })
  await db.productos.put({ id: 'p1', nombre: 'Yerba', precio: 100 } as never)
  await db.cola.put({ id: 'c1', entidad: 'venta', operacion: 'crear', datos: {}, intentos: 0, creadoEn: 1 })
}

beforeEach(async () => {
  localStorage.clear()
  await db.delete()
  await db.open()
  sesion = { data: { session: { user: { id: 'u1' } } } }
  vinculo = { data: null, error: null }
  negocioRemoto = { data: null, error: null }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('SEG-05: vendedor quitado del negocio', () => {
  it('borra productos, cola y negocio locales cuando el servidor confirma que ya no pertenece', async () => {
    await sembrarNegocioLocal()
    const estado = await cargarEstadoAcceso()
    expect(estado.negocio).toBeNull()
    expect(estado.motivoSinNegocio).toBe('vendedor_quitado')
    expect(await db.productos.count()).toBe(0)
    expect(await db.cola.count()).toBe(0)
    expect(await db.negocio.count()).toBe(0)
  })

  it('el motivo sigue disponible en la comprobación siguiente, ya sin datos locales', async () => {
    await sembrarNegocioLocal()
    await cargarEstadoAcceso()
    const segundo = await cargarEstadoAcceso()
    expect(segundo.motivoSinNegocio).toBe('vendedor_quitado')
  })

  it('también limpia si el vínculo existe pero el negocio ya no es visible', async () => {
    await sembrarNegocioLocal()
    vinculo = { data: { negocio_id: 'n1', rol: 'vendedor', nombre: 'Ana' }, error: null }
    const estado = await cargarEstadoAcceso()
    expect(estado.motivoSinNegocio).toBe('vendedor_quitado')
    expect(await db.productos.count()).toBe(0)
  })

  it('no borra nada si sólo falla la red (error de consulta)', async () => {
    await sembrarNegocioLocal()
    vinculo = { data: null, error: new Error('red') }
    const estado = await cargarEstadoAcceso()
    expect(estado.verificadoRemoto).toBe(false)
    expect(estado.motivoSinNegocio).toBeUndefined()
    expect(await db.productos.count()).toBe(1)
    expect(await db.cola.count()).toBe(1)
    expect(await db.negocio.count()).toBe(1)
  })

  it('no borra nada sin conexión', async () => {
    await sembrarNegocioLocal()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await cargarEstadoAcceso()
    expect(await db.productos.count()).toBe(1)
  })

  it('una cuenta nueva sin negocio y sin copia local no recibe aviso de baja', async () => {
    const estado = await cargarEstadoAcceso()
    expect(estado.negocio).toBeNull()
    expect(estado.motivoSinNegocio).toBeUndefined()
  })

  it('el aviso se borra cuando el usuario vuelve a tener negocio', async () => {
    await sembrarNegocioLocal()
    await cargarEstadoAcceso()
    vinculo = { data: { negocio_id: 'n2', rol: 'vendedor', nombre: 'Ana' }, error: null }
    negocioRemoto = { data: { id: 'n2', nombre: 'Otro' }, error: null }
    const estado = await cargarEstadoAcceso()
    expect(estado.negocio?.negocioId).toBe('n2')
    expect(estado.motivoSinNegocio).toBeUndefined()
  })
})
