import { describe, it, expect } from 'vitest'
import { armarCumple, cumplesProximos, diasHastaCumple, limpiarNota, mensajeCumple, textoCumple } from '@/dominio/cumpleanos'
import { aLaNube, deLaNube } from '@/datos/nube/mapeo'

const AHORA = new Date('2026-11-07T15:00:00').getTime()

describe('cumpleaños', () => {
  it('arma y valida la fecha sin año', () => {
    expect(armarCumple(12, 3)).toBe('03-12')
    expect(armarCumple(31, 4)).toBeNull()
    expect(armarCumple(29, 2)).toBe('02-29')
    expect(textoCumple('03-12')).toBe('12 de marzo')
    expect(textoCumple('13-01')).toBe('')
  })

  it('cuenta los días que faltan, pasando de año', () => {
    expect(diasHastaCumple('11-07', AHORA)).toBe(0)
    expect(diasHastaCumple('11-08', AHORA)).toBe(1)
    expect(diasHastaCumple('11-06', AHORA)).toBe(364)
    expect(diasHastaCumple(undefined, AHORA)).toBeNull()
  })

  it('el 29 de febrero se festeja el 28 en años no bisiestos', () => {
    expect(diasHastaCumple('02-29', new Date('2027-02-27T10:00:00').getTime())).toBe(1)
  })

  it('lista los próximos, el más cercano primero', () => {
    const clientes = [{ nombre: 'Ana', cumpleanos: '11-10' }, { nombre: 'Beto', cumpleanos: '11-07' }, { nombre: 'Caro', cumpleanos: '12-24' }, { nombre: 'Dani' }]
    expect(cumplesProximos(clientes, AHORA, 7).map((c) => c.cliente.nombre)).toEqual(['Beto', 'Ana'])
    expect(mensajeCumple({ nombre: 'Beto Gómez' }, 'Almacén Rosales')).toContain('Beto!')
  })

  it('la nota se recorta y vacía no se guarda', () => {
    expect(limpiarNota('   ')).toBeUndefined()
    expect(limpiarNota('x'.repeat(600))).toHaveLength(500)
  })

  it('cumpleaños y nota viajan a la nube, y al borrarlos van como null', () => {
    const [parte] = aLaNube('cliente', { id: 'c', nombre: 'Ana', telefono: null, cumpleanos: '03-12', nota: 'Pan negro' }, 'n-1')
    expect(parte.filas[0]).toMatchObject({ cumpleanos: '03-12', nota: 'Pan negro' })
    const [sin] = aLaNube('cliente', { id: 'c', nombre: 'Ana', telefono: null }, 'n-1')
    expect(sin.filas[0]).toMatchObject({ cumpleanos: null, nota: null })
    expect(deLaNube('clientes', { id: 'c', nombre: 'Ana', cumpleanos: null, nota: null })).not.toHaveProperty('cumpleanos')
  })
})
