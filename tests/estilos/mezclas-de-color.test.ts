// @vitest-environment node
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import mezclasDeColor, { leerTemas, mezclar } from '../../postcss/mezclas-de-color.mjs'

const HOJAS = ['src/app/globals.css', 'src/ui/sistema/pulido-final.css']

async function procesar(css: string) {
  return (await postcss([mezclasDeColor()]).process(css, { from: undefined })).css
}

describe('mezclar', () => {
  it('hace la misma cuenta que color-mix in srgb', () => {
    expect(mezclar('#000000', 50, '#FFFFFF')).toBe('#808080')
    expect(mezclar('#12694E', 100, '#FFFFFF')).toBe('#12694e')
    expect(mezclar('#12694E', 0, '#FFFFFF')).toBe('#ffffff')
  })

  it('contra transparente da el color con opacidad', () => {
    expect(mezclar('#12694E', 18, 'transparent')).toBe('rgba(18, 105, 78, 0.18)')
  })
})

describe('plugin de mezclas', () => {
  it('cambia cada mezcla por una variable calculada para los dos temas', async () => {
    const css = await procesar('.a { border: 1px solid color-mix(in srgb, var(--verde) 50%, var(--hueso-2)); }')
    const { claro, oscuro } = leerTemas()

    expect(css).not.toContain('color-mix(')
    expect(css).toContain('var(--mx-verde-50-hueso-2)')
    expect(css).toContain(`--mx-verde-50-hueso-2: ${mezclar(claro.verde, 50, claro['hueso-2'])}`)
    expect(css).toContain(`--mx-verde-50-hueso-2: ${mezclar(oscuro.verde, 50, oscuro['hueso-2'])}`)
  })

  it('saca el @supports de Tailwind para que el navegador viejo no pinte el color puro', async () => {
    const css = await procesar(`
      .a { background: var(--verde); }
      @supports (color: color-mix(in lab, red, red)) {
        .a { background: color-mix(in srgb, var(--verde) 6%, var(--hueso-2)); }
      }
    `)
    expect(css).not.toContain('@supports')
    // La mezcla queda después del respaldo: en cualquier navegador gana ella.
    expect(css.indexOf('var(--mx-verde-6-hueso-2)')).toBeGreaterThan(css.indexOf('background: var(--verde)'))
  })

  it('antepone vh a cada dvh para los navegadores que no lo conocen', async () => {
    const css = await procesar('.a { min-height: calc(100dvh - 2rem); }')
    expect(css.indexOf('calc(100vh - 2rem)')).toBeGreaterThan(-1)
    expect(css.indexOf('calc(100vh - 2rem)')).toBeLessThan(css.indexOf('calc(100dvh - 2rem)'))
  })

  it('falla en la compilación si se mezcla un token que no existe', async () => {
    await expect(procesar('.a { color: color-mix(in srgb, var(--inventado) 5%, transparent); }')).rejects.toThrow(
      '--inventado',
    )
  })

  it.each(HOJAS)('%s queda sin color-mix después del plugin', async (hoja) => {
    const css = await procesar(readFileSync(hoja, 'utf8'))
    expect(css.match(/color-mix\([^;]*/g) ?? []).toEqual([])
  })
})
