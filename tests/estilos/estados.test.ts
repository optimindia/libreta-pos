// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/ui/sistema/f/estados.css', 'utf8')
const layout = readFileSync('src/app/layout.tsx', 'utf8')

describe('estilos de los estados (vacío, carga, error)', () => {
  it('se carga junto al resto del sistema F', () => {
    expect(layout).toContain("'../ui/sistema/f/estados.css'")
  })

  it('no usa color-mix (rompe el build con variables)', () => {
    expect(css).not.toContain('color-mix(')
  })

  it('el esqueleto se queda quieto si la persona pidió menos movimiento', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\{[^}]*animation:\s*none/)
  })

  it('usa los tokens --f-* y no colores sueltos', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).toContain('var(--f-')
  })
})
