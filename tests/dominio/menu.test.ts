import { describe, it, expect } from 'vitest'
import { alternarOculta, armarMenu, MENU_INICIAL, mover, normalizarMenu, pestanasMovil } from '@/dominio/menu'

const todo = () => true

describe('normalizarMenu', () => {
  it('sin nada guardado usa el orden de fábrica', () => {
    expect(normalizarMenu(null)).toEqual(MENU_INICIAL)
  })

  it('descarta ids raros o repetidos y suma las secciones nuevas al final', () => {
    const menu = normalizarMenu({ orden: ['plata', 'plata', 'hackeo', 'inicio'], ocultas: ['stock', 'vender'], compacta: true })
    expect(menu.orden[0]).toBe('plata')
    expect(menu.orden).toHaveLength(MENU_INICIAL.orden.length)
    expect(menu.ocultas).toEqual(['stock'])
    expect(menu.compacta).toBe(true)
  })
})

describe('armarMenu', () => {
  it('Inicio y Vender van siempre primero', () => {
    expect(armarMenu(MENU_INICIAL, todo).visibles.slice(0, 2)).toEqual(['inicio', 'vender'])
  })

  it('una sección oculta sale del menú pero queda para volver a mostrarla', () => {
    const menu = armarMenu(alternarOculta(MENU_INICIAL, 'pedidos'), todo)
    expect(menu.visibles).not.toContain('pedidos')
    expect(menu.ocultas).toEqual(['pedidos'])
  })

  it('una función apagada no aparece ni como oculta', () => {
    const menu = armarMenu(alternarOculta(MENU_INICIAL, 'pedidos'), (id) => id !== 'pedidos' && id !== 'fiados')
    expect(menu.visibles).not.toContain('fiados')
    expect(menu.ocultas).toEqual([])
  })

  it('no se puede ocultar Vender', () => {
    expect(alternarOculta(MENU_INICIAL, 'vender')).toBe(MENU_INICIAL)
  })
})

describe('pestanasMovil', () => {
  it('toma las dos primeras secciones después de las fijas', () => {
    expect(pestanasMovil(armarMenu(MENU_INICIAL, todo).visibles)).toEqual(['fiados', 'stock'])
  })

  it('respeta el orden elegido', () => {
    const menu = mover(MENU_INICIAL, 'plata', -1)
    expect(pestanasMovil(armarMenu(menu, todo).visibles)).toEqual(['fiados', 'plata'])
  })
})

describe('mover', () => {
  it('no se sale de la lista', () => {
    expect(mover(MENU_INICIAL, 'fiados', -1)).toBe(MENU_INICIAL)
    expect(mover(MENU_INICIAL, 'cuenta', 1)).toBe(MENU_INICIAL)
  })
})
