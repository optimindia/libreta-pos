// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/* WCAG 2.2 AA sobre los tokens y el CSS reales del sistema F: contraste de
   texto (1.4.3, 4.5:1), de controles y foco (1.4.11 y 2.4.13, 3:1), foco
   visible (2.4.7), tamaño del objetivo (2.5.8, 24 px; en celu 44 px) y
   movimiento reducido (2.3.3). */

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

const leer = (ruta: string) => readFileSync(ruta, 'utf8')
const CAPA = 'src/ui/sistema/f/accesibilidad.css'
/** La capa nueva puede no existir todavía: así la prueba falla por el motivo correcto. */
const leerCapa = () => { try { return leer(CAPA) } catch { return '' } }
const tokens = leer('src/ui/sistema/f/tokens.css')
const claro = bloque(tokens, ':root')
const temas: Record<string, Record<string, string>> = { claro, oscuro: { ...claro, ...bloque(tokens, "[data-tema='oscuro']") } }

describe.each(Object.entries(temas))('contraste, tema %s', (_, t) => {
  it.each([
    ['f-nav-guardado', 'f-nav'],
    ['f-nav-pendiente', 'f-nav'],
    ['f-nav-insignia', 'f-nav'],
    ['f-sobre-aviso', 'f-aviso'],
    ['f-tinta', 'f-superficie-2'],
    ['f-verde', 'f-superficie-2'],
    ['f-coral', 'f-superficie-2'],
    ['f-tinta', 'f-verde-suave'],
    ['f-tinta', 'f-coral-suave'],
    ['f-tinta', 'f-ambar-suave'],
    ['f-tinta-2', 'f-verde-suave'],
  ])('texto %s sobre %s (4.5:1)', (frente, fondo) => {
    expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['f-borde', 'f-fondo'],
    ['f-borde', 'f-superficie'],
    ['f-borde', 'f-superficie-2'],
    ['f-foco', 'f-fondo'],
    ['f-foco', 'f-superficie'],
    ['f-foco', 'f-superficie-2'],
    ['f-foco-nav', 'f-nav'],
    ['f-foco-nav', 'f-nav-activo'],
  ])('control o foco %s contra %s (3:1)', (frente, fondo) => {
    expect(t[frente], `falta el token ${frente}`).toBeTruthy()
    expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(3)
  })
})

function archivos(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? archivos(p, ext) : p.endsWith(ext) ? [p] : []
  })
}

describe('foco visible', () => {
  const accesibilidad = leerCapa()

  it('existe la capa de accesibilidad y la carga el layout', () => {
    expect(accesibilidad.length).toBeGreaterThan(0)
    expect(leer('src/app/layout.tsx')).toContain("ui/sistema/f/accesibilidad.css")
  })

  it('la barra y el lateral oscuros usan un foco claro (tinta sobre tinta no se ve)', () => {
    expect(accesibilidad).toMatch(/\.f-lateral[^{]*\{[^}]*--f-foco:\s*var\(--f-foco-nav\)/)
    expect(accesibilidad).toMatch(/\.f-barra[^{]*\{[^}]*--f-foco:\s*var\(--f-foco-nav\)/)
  })

  it('todo control nativo tiene un anillo de foco de respaldo', () => {
    expect(accesibilidad).toMatch(/:where\([^)]*\bbutton\b[^)]*\bselect\b[^)]*\):focus-visible\s*\{[^}]*outline:\s*3px solid var\(--f-foco\)/)
    expect(accesibilidad).toContain('summary')
  })

  it('los campos que esconden su outline lo devuelven en el contenedor (buscador y monto de la caja)', () => {
    expect(accesibilidad).toMatch(/\.f-buscar:focus-within[^{]*\{[^}]*outline:\s*3px solid var\(--f-foco\)/)
    expect(accesibilidad).toMatch(/\.f-cobro-monto:focus-within[^{]*\{[^}]*outline:\s*3px solid var\(--f-foco\)/)
  })

  it('ninguna hoja de estilos apaga el outline de un control sin ofrecer otro foco', () => {
    const sospechosos: string[] = []
    for (const archivo of archivos('src', '.css')) {
      const css = leer(archivo).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selector] of css.matchAll(/([^{}]+)\{[^}]*outline:\s*(?:0|none)\b[^}]*\}/g)) {
        const s = selector.trim()
        if (s.includes(':focus-visible') || s.includes(':focus-within')) continue
        // un campo dentro de un contenedor que lo recibe por :focus-within
        if (/^\.f-buscar input$|^\.f-cobro-monto input$/.test(s)) continue
        // el panel de una hoja recibe el foco por código; no es un control
        if (s === '.f-hoja' || s === "[id='contenido']:focus") continue
        // el foco sólido de los campos está en la regla siguiente (:focus-visible)
        if (/^\.f-entrada:focus$|^input,\s*select,\s*textarea$/.test(s.replace(/\s+/g, ' '))) continue
        sospechosos.push(`${archivo}: ${s}`)
      }
    }
    expect(sospechosos).toEqual([])
  })
})

describe('el estado activo no depende sólo del color', () => {
  const nav = leerCapa()
  it('la sección actual lleva una marca de forma, además del color', () => {
    expect(nav).toMatch(/\.f-barra-item:is\(\[aria-current='page'\][^{]*::after/)
    expect(nav).toMatch(/\.f-nav-item\[aria-current='page'\]::before/)
  })
})

describe('objetivos táctiles (2.5.8)', () => {
  const accesibilidad = leerCapa()
  const CONTROLES_CHICOS = ['.f-paso button', '.f-producto-estrella', '.f-nav-mini', '.nb-icono-boton', '.f-hoja-cerrar', '.f-visor-cerrar']

  it.each(CONTROLES_CHICOS)('%s mide 44 px en pantallas táctiles', (selector) => {
    const coarse = accesibilidad.slice(accesibilidad.indexOf('@media (pointer: coarse)'))
    expect(coarse).toContain(selector)
    expect(coarse).toMatch(/min-width:\s*44px/)
    expect(coarse).toMatch(/min-height:\s*44px/)
  })

  it('ningún control definido en el CSS baja de 24 px', () => {
    const chicos: string[] = []
    const CONTROL = /(button|\bbtn\b|boton|icono|cerrar|estrella|tecla|billete|chip|segmento|paso|mini|enlace|atajo|accion|fila)/i
    for (const archivo of archivos('src', '.css')) {
      const css = leer(archivo).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selector, cuerpo] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
        const s = selector.trim()
        if (/\bsvg\b|::|\bi\b|\bb\b|\binput\b|\bspan\b|-n$|numero|avatar|puesto|rango|punto|marco|icono-boton svg|interruptor|check/.test(s) || !CONTROL.test(s)) continue
        for (const [, prop, valor] of cuerpo.matchAll(/(?:^|[;\s])(min-width|min-height|width|height):\s*(\d+)px/g).map((m) => [m[0], m[1], Number(m[2])] as const)) {
          if (valor < 24) chicos.push(`${archivo}: ${s} { ${prop}: ${valor}px }`)
        }
      }
    }
    expect(chicos).toEqual([])
  })
})

describe('movimiento reducido (2.3.3)', () => {
  it('hay una regla global que apaga animaciones y transiciones', () => {
    const css = leer('src/app/globals.css')
    const regla = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(regla).toMatch(/animation-duration:\s*0\.01ms !important/)
    expect(regla).toMatch(/transition-duration:\s*0\.01ms !important/)
    expect(regla).toMatch(/animation-iteration-count:\s*1 !important/)
  })
})

describe('saltar al contenido', () => {
  it('el enlace sólo se ve al recibir el foco y no tapa nada fijo', () => {
    const css = leerCapa()
    expect(css).toMatch(/\.f-saltar:not\(:focus\)[^{]*\{[^}]*(clip|transform: translateY\(-)/)
    expect(css).toMatch(/\.f-saltar:focus[^{]*\{[^}]*outline:\s*3px solid/)
  })
})
