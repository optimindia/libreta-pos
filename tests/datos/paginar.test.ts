import { describe, it, expect } from 'vitest'
import { enTandas, todasLasFilas } from '@/datos/nube/paginar'

/** Simula una tabla de Supabase que corta cada respuesta en `limite` filas. */
function tabla(total: number, limite = 1000) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }))
  const pedidos: Array<[number, number]> = []
  const pedir = async (desde: number, hasta: number) => {
    pedidos.push([desde, hasta])
    return { data: filas.slice(desde, Math.min(hasta + 1, desde + limite)), error: null }
  }
  return { pedir, pedidos }
}

describe('todasLasFilas', () => {
  it('trae las 2.500 filas aunque el servidor corte de a 1.000', async () => {
    const { pedir, pedidos } = tabla(2500)
    const filas = await todasLasFilas(pedir)
    expect(filas).toHaveLength(2500)
    expect(new Set(filas.map((fila) => fila.id)).size).toBe(2500)
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('con justo 1.000 filas hace una vuelta más para confirmar que no hay otra página', async () => {
    const { pedir, pedidos } = tabla(1000)
    expect(await todasLasFilas(pedir)).toHaveLength(1000)
    expect(pedidos).toHaveLength(2)
  })

  it('una tabla vacía no falla', async () => {
    expect(await todasLasFilas(tabla(0).pedir)).toEqual([])
  })

  it('un error corta y se propaga: nunca devuelve media tabla como si fuera toda', async () => {
    let vuelta = 0
    const pedir = async () => (vuelta++ === 0
      ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }
      : { data: null, error: new Error('sin red') })
    await expect(todasLasFilas(pedir)).rejects.toThrow('sin red')
  })
})

describe('enTandas', () => {
  it('parte 450 ids en tandas de 200', () => {
    expect(enTandas(Array.from({ length: 450 }, (_, i) => i)).map((tanda) => tanda.length)).toEqual([200, 200, 50])
  })
})
