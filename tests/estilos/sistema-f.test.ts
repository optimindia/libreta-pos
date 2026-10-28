// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Lee los tokens --f-* de un bloque de f/tokens.css. */
function bloque(css: string, selector: string): Record<string, string> {
  const desde = css.indexOf('{', css.indexOf(selector)) + 1
  const hasta = css.indexOf('}', desde)
  return Object.fromEntries([...css.slice(desde, hasta).matchAll(/--(f-[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)].map(([, n, v]) => [n, v]))
}

function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const css = readFileSync('src/ui/sistema/f/tokens.css', 'utf8')
const claro = bloque(css, ':root')
const temas = { claro, oscuro: { ...claro, ...bloque(css, "[data-tema='oscuro']") } }

describe.each(Object.entries(temas))('sistema F, tema %s', (_, t) => {
  it.each([
    ['f-tinta', 'f-fondo'],
    ['f-tinta', 'f-superficie'],
    ['f-tinta-2', 'f-fondo'],
    ['f-tinta-2', 'f-superficie'],
    ['f-tinta-2', 'f-superficie-2'],
    ['f-sobre-lima', 'f-lima'],
    ['f-verde', 'f-superficie'],
    ['f-verde', 'f-verde-suave'],
    ['f-coral', 'f-coral-suave'],
    ['f-coral', 'f-superficie'],
    ['f-ambar', 'f-ambar-suave'],
    ['f-sobre-elegido', 'f-elegido'],
    ['f-nav-texto', 'f-nav'],
    ['f-nav-texto-activo', 'f-nav-activo'],
  ])('%s se lee sobre %s', (frente, fondo) => {
    expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(4.5)
  })

  it('el número de la venta se lee sobre su círculo', () => {
    expect(contraste(t['f-en-venta-numero'], t['f-en-venta'])).toBeGreaterThanOrEqual(4.5)
  })
})
