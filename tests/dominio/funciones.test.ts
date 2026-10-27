import { describe, expect, it } from 'vitest'
import {
  cambiarFuncion,
  cantidadFuncionesActivas,
  CLAVES_FUNCION,
  funcionActiva,
  normalizarFunciones,
} from '@/dominio/funciones'

describe('funciones por negocio', () => {
  it('activa todo por defecto y descarta claves desconocidas', () => {
    const funciones = normalizarFunciones({ pedidos: false, inventarioFantasma: false })
    expect(CLAVES_FUNCION.every((clave) => funciones[clave])).toBe(false)
    expect(funciones.pedidos).toBe(false)
    expect(funciones.stock).toBe(true)
    expect(funciones).not.toHaveProperty('inventarioFantasma')
  })

  it('permite apagar una función opcional sin mutar la anterior', () => {
    const anteriores = normalizarFunciones(undefined)
    const siguientes = cambiarFuncion(anteriores, 'escanerVenta', false)
    expect(siguientes.escanerVenta).toBe(false)
    expect(anteriores.escanerVenta).toBe(true)
    expect(funcionActiva(siguientes, 'escanerVenta')).toBe(false)
  })

  it('mantiene un camino mínimo para operar y volver a configurar', () => {
    const funciones = cambiarFuncion({ vender: true, cuenta: true, configuracion: true }, 'vender', false)
    expect(funciones.vender).toBe(true)
    expect(funciones.cuenta).toBe(true)
    expect(funciones.configuracion).toBe(true)
    expect(cantidadFuncionesActivas({ pedidos: false })).toBe(CLAVES_FUNCION.length - 1)
  })
})
