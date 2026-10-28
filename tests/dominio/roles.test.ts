import { describe, it, expect } from 'vitest'
import { rolDe, rutaPermitida, seccionPermitida } from '@/dominio/roles'

describe('roles', () => {
  it('sólo "vendedor" es vendedor; cualquier otra cosa es dueño', () => {
    expect(rolDe('vendedor')).toBe('vendedor')
    expect(rolDe('dueno')).toBe('dueno')
    expect(rolDe(undefined)).toBe('dueno')
    expect(rolDe('admin')).toBe('dueno')
  })

  it('el vendedor no ve plata, configuración ni Centro Pro', () => {
    for (const id of ['plata', 'config', 'operacion'] as const) expect(seccionPermitida('vendedor', id)).toBe(false)
    for (const id of ['inicio', 'vender', 'fiados', 'stock', 'clientes', 'pedidos', 'historial', 'cuenta'] as const) expect(seccionPermitida('vendedor', id)).toBe(true)
    expect(seccionPermitida('dueno', 'plata')).toBe(true)
  })

  it('las rutas directas también quedan cerradas para el vendedor', () => {
    expect(rutaPermitida('vendedor', '/plata')).toBe(false)
    expect(rutaPermitida('vendedor', '/config')).toBe(false)
    expect(rutaPermitida('vendedor', '/operacion/facturas')).toBe(false)
    expect(rutaPermitida('vendedor', '/plataforma')).toBe(true)
    expect(rutaPermitida('vendedor', '/vender')).toBe(true)
    expect(rutaPermitida('dueno', '/plata')).toBe(true)
  })
})
