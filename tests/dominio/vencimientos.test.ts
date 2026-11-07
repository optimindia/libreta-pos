import { describe, it, expect } from 'vitest'
import { diasParaVencer, estadoVence, porVencer, textoDeVence, textoVence, venceDeTexto } from '@/dominio/vencimientos'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'
import type { Producto } from '@/dominio/tipos'

const AHORA = new Date('2026-11-07T10:00:00').getTime()
const p = (parcial: Partial<Producto>) => ({ id: 'x', codigoBarras: null, nombre: 'X', costo: 1, precio: 2, stock: 5, stockMinimo: 0, actualizadoEn: 0, ...parcial }) as Producto

describe('vencimientos', () => {
  it('cuenta días por fecha, no por horas', () => {
    expect(diasParaVencer(p({ venceEl: venceDeTexto('2026-11-07') }), AHORA)).toBe(0)
    expect(diasParaVencer(p({ venceEl: venceDeTexto('2026-11-08') }), AHORA)).toBe(1)
    expect(diasParaVencer(p({ venceEl: venceDeTexto('2026-11-01') }), AHORA)).toBe(-6)
    expect(diasParaVencer(p({}), AHORA)).toBeNull()
    expect(estadoVence(p({ venceEl: venceDeTexto('2026-11-30') }), AHORA)).toBe('lejos')
    expect(estadoVence(p({ venceEl: venceDeTexto('2026-11-10') }), AHORA)).toBe('pronto')
  })

  it('lista los que vencen pronto con stock, el más urgente primero', () => {
    const lista = porVencer([
      p({ id: 'a', nombre: 'Leche', venceEl: venceDeTexto('2026-11-09') }),
      p({ id: 'b', nombre: 'Yogur', venceEl: venceDeTexto('2026-11-05') }),
      p({ id: 'c', nombre: 'Queso', venceEl: venceDeTexto('2026-11-05'), stock: 0 }),
      p({ id: 'd', nombre: 'Arroz', venceEl: venceDeTexto('2027-05-01') }),
    ], AHORA)
    expect(lista.map((item) => item.producto.id)).toEqual(['b', 'a'])
    expect(textoVence(-2)).toBe('Venció hace 2 días')
    expect(textoVence(1)).toBe('Vence mañana')
  })

  it('va y vuelve del campo de fecha', () => {
    expect(textoDeVence(venceDeTexto('2026-12-24'))).toBe('2026-12-24')
    expect(venceDeTexto('')).toBeUndefined()
  })

  it('viaja a la nube como vence_el y se puede borrar', () => {
    const vence = venceDeTexto('2026-12-24') as number
    const [con] = aLaNube('producto', { id: 'x', nombre: 'X', venceEl: vence }, 'n-1')
    expect(con.filas[0].vence_el).toBe(new Date(vence).toISOString())
    const [sin] = aLaNube('producto', { id: 'x', nombre: 'X' }, 'n-1')
    expect(sin.filas[0].vence_el).toBeNull()
    expect(deLaNube('productos', { id: 'x', vence_el: new Date(vence).toISOString() }).venceEl).toBe(vence)
    expect(deLaNube('productos', { id: 'x', vence_el: null })).not.toHaveProperty('venceEl')
  })
})
