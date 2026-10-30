// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/* Reglas de diseño que mantienen las pantallas prolijas en la PC, con
   pocos o muchos datos:
   · tarjetas que van lado a lado terminan a la misma altura (las grillas
     estiran, no alinean arriba);
   · los buscadores ocupan todo el ancho de su fila (nunca un ancho fijo). */

function archivos(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? archivos(p, ext) : p.endsWith(ext) ? [p] : []
  })
}

function reglas(): Array<{ archivo: string; selector: string; cuerpo: string }> {
  return archivos('src', '.css').flatMap((archivo) => {
    const css = readFileSync(archivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, selector, cuerpo]) => ({ archivo, selector: selector.trim(), cuerpo }))
  })
}

/** Únicas excepciones, cada una con su motivo. */
const ALINEADAS_ARRIBA = new Set([
  // El panel de la venta queda fijo (sticky) mientras se desliza el catálogo.
  '.f-vender-cuerpo',
  // Cabecera de Control Pro: título a la izquierda y un indicador chico a la derecha.
  '.f-pro-cabecera',
  // Panel de administración interno (no lo ve el almacenero).
  '.f-admin-cuerpo',
  // Estilos viejos de Ajustes, reemplazados por .f-config-cuerpo.
  '.page-config',
])

describe('alineación de tarjetas', () => {
  it('ninguna grilla alinea sus tarjetas arriba (quedarían de alturas distintas)', () => {
    const malas = reglas()
      .filter(({ cuerpo }) => /align-items:\s*start\b/.test(cuerpo))
      .filter(({ selector }) => !ALINEADAS_ARRIBA.has(selector))
      .map(({ archivo, selector }) => `${archivo}: ${selector}`)
    expect(malas).toEqual([])
  })

  it('las grillas de tarjetas de cada pantalla estiran a la misma altura', () => {
    const css = (ruta: string) => readFileSync(ruta, 'utf8')
    expect(css('src/ui/plata/plata.css')).toMatch(/\.fp-grilla\s*\{[^}]*align-items:\s*stretch/)
    expect(css('src/ui/pedidos/pedidos.css')).toMatch(/\.f-pedidos-lista\s*\{[^}]*align-items:\s*stretch/)
    expect(css('src/ui/fiados/fiados.css')).toMatch(/\.f-fiados\s*\{[^}]*align-items:\s*stretch/)
  })
})

describe('buscadores', () => {
  it('ningún buscador tiene un ancho máximo propio: ocupa toda su fila', () => {
    const malas = reglas()
      .filter(({ selector, cuerpo }) => /\.f-buscar\b/.test(selector) && /max-width:\s*\d/.test(cuerpo))
      .map(({ archivo, selector }) => `${archivo}: ${selector}`)
    expect(malas).toEqual([])
  })
})
