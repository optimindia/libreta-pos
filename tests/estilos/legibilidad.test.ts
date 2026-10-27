// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leerTemas } from '../../postcss/mezclas-de-color.mjs'

/** Contraste WCAG entre dos colores hexadecimales. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

// Un monitor viejo o barato aplasta los tonos parecidos: lo que en una
// pantalla buena es un gris suave, ahí desaparece. Estos pisos son los que
// pide WCAG para texto (4.5) y para bordes de controles (un mínimo visible).
const TEXTO = 4.5
const BORDE = 1.35
const SUPERFICIE = 1.08

const temas = leerTemas()

describe.each(Object.entries(temas))('tema %s', (_, t) => {
  it.each([
    ['tinta', 'hueso'],
    ['tenue', 'hueso'],
    ['tenue', 'hueso-2'],
    ['tenue', 'chip-fondo'],
    ['tenue', 'superficie-sutil'],
    ['verde', 'hueso'],
    ['verde', 'hueso-2'],
    ['verde-texto', 'verde'],
    ['ambar', 'hueso'],
    ['ambar', 'hueso-2'],
    ['ambar', 'ambar-fondo'],
  ])('el texto %s sobre %s se lee', (frente, fondo) => {
    expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(TEXTO)
  })

  it.each([
    ['linea', 'hueso'],
    ['linea', 'hueso-2'],
  ])('el borde %s se ve sobre %s', (borde, fondo) => {
    expect(contraste(t[borde], t[fondo])).toBeGreaterThanOrEqual(BORDE)
  })

  it('una tarjeta se distingue del fondo de la página', () => {
    expect(contraste(t['hueso-2'], t.hueso)).toBeGreaterThanOrEqual(SUPERFICIE)
  })
})

describe('tamaño de letra', () => {
  const PISO_PX = 12

  it.each(['src/app/globals.css', 'src/ui/sistema/pulido-final.css'])('%s no baja de 12px', (hoja) => {
    const chicos = [...readFileSync(hoja, 'utf8').matchAll(/font-size:\s*([0-9.]+)(rem|px)\b/g)]
      .map(([texto, valor, unidad]) => ({ texto, px: Number(valor) * (unidad === 'rem' ? 16 : 1) }))
      .filter(({ px }) => px < PISO_PX)
      .map(({ texto }) => texto)
    expect(chicos).toEqual([])
  })

  it('ningún componente usa text-[…px] por debajo de 12px', () => {
    const chicos = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter((ruta) => ruta.endsWith('.tsx'))
      .map((ruta) => join('src', ruta))
      .flatMap((archivo) =>
      [...readFileSync(archivo, 'utf8').matchAll(/text-\[([0-9.]+)px\]/g)]
        .filter(([, px]) => Number(px) < PISO_PX)
        .map(([clase]) => `${archivo}: ${clase}`),
    )
    expect(chicos).toEqual([])
  })
})
