import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `color-mix()` existe recién desde Chrome 111 y Safari 16.2 (2023). Un
 * navegador anterior —el Chrome que quedó en una PC con Windows 7, una
 * tablet vieja del mostrador— no la entiende y descarta la declaración
 * entera: el borde, el fondo o la sombra desaparecen sin aviso. Por eso la
 * app "se veía mal en algunas computadoras y bien en otras".
 *
 * Este plugin resuelve cada `color-mix(in srgb, var(--a) N%, var(--b))` en
 * tiempo de compilación. Como los tokens cambian con el tema, cada mezcla se
 * vuelve una variable propia (`--mx-…`) calculada para el tema claro y para
 * el oscuro. Las variables CSS funcionan desde 2016, así que el resultado se
 * ve igual en cualquier navegador.
 */

// Desde la raíz del proyecto: Turbopack copia el plugin a .next/ antes de
// correrlo, así que una ruta relativa a este archivo no sirve.
const TOKENS = join(process.cwd(), 'src/ui/sistema/tokens.css')
const MEZCLA =
  /color-mix\(\s*in\s+srgb\s*,\s*var\(\s*--([a-z0-9-]+)\s*\)\s+([0-9.]+)%\s*,\s*(?:var\(\s*--([a-z0-9-]+)\s*\)|(transparent))\s*\)/g

function leerBloque(css, selector) {
  const inicio = css.indexOf(selector)
  if (inicio === -1) throw new Error(`tokens.css: falta el bloque ${selector}`)
  const desde = css.indexOf('{', inicio) + 1
  const hasta = css.indexOf('}', desde)
  const valores = {}
  for (const [, nombre, valor] of css.slice(desde, hasta).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    valores[nombre] = valor.trim()
  }
  return valores
}

export function leerTemas(css = readFileSync(TOKENS, 'utf8')) {
  const claro = leerBloque(css, ':root')
  const oscuro = { ...claro, ...leerBloque(css, "[data-tema='oscuro']") }
  return { claro, oscuro }
}

function hexARgb(hex) {
  const limpio = hex.replace('#', '')
  const largo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) return null
  return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16))
}

/** Misma cuenta que hace el navegador con `in srgb`: promedio por canal. */
export function mezclar(colorA, porcentaje, colorB) {
  const a = hexARgb(colorA)
  if (!a) throw new Error(`no se puede mezclar ${colorA}: se espera un color hexadecimal`)
  const p = porcentaje / 100
  if (colorB === 'transparent') {
    return `rgba(${a.join(', ')}, ${Number(p.toFixed(3))})`
  }
  const b = hexARgb(colorB)
  if (!b) throw new Error(`no se puede mezclar ${colorB}: se espera un color hexadecimal`)
  const canal = (i) => Math.round(a[i] * p + b[i] * (1 - p))
  return `#${[0, 1, 2].map((i) => canal(i).toString(16).padStart(2, '0')).join('')}`
}

function nombreDeMezcla(a, porcentaje, b) {
  return `--mx-${a}-${String(porcentaje).replace('.', '_')}-${b ?? 'transparente'}`
}

export default function mezclasDeColor() {
  return {
    postcssPlugin: 'libreta-mezclas-de-color',
    Once(raiz, { Rule, Declaration }) {
      const temas = leerTemas()
      const usadas = new Map()

      raiz.walkDecls((declaracion) => {
        // `dvh` (alto real de la pantalla del celu) llegó en 2022. Antes va la
        // misma declaración en `vh`: el navegador viejo se queda con esa y el
        // nuevo la pisa con la siguiente.
        if (/\d(dvh)\b/.test(declaracion.value)) {
          declaracion.cloneBefore({ value: declaracion.value.replace(/(\d)dvh\b/g, '$1vh') })
        }
        if (!declaracion.value.includes('color-mix(')) return
        declaracion.value = declaracion.value.replace(MEZCLA, (_, a, porcentaje, b) => {
          const nombre = nombreDeMezcla(a, porcentaje, b)
          usadas.set(nombre, { a, porcentaje: Number(porcentaje), b: b ?? 'transparent' })
          return `var(${nombre})`
        })
      })

      // Tailwind ya había "resuelto" estas mezclas a su manera: deja el primer
      // color puro como respaldo y la mezcla real adentro de un @supports. En
      // un navegador viejo eso pintaba un fondo que debía ser un verde al 6%
      // con el verde entero. Ya resuelta la mezcla, el @supports sobra: se
      // saca y la declaración buena queda después del respaldo, así que gana.
      raiz.walkAtRules('supports', (regla) => {
        if (!/color-mix\(in lab/.test(regla.params)) return
        if (regla.toString().slice(regla.params.length).includes('color-mix(')) return
        regla.replaceWith(regla.nodes)
      })

      if (usadas.size === 0) return

      for (const [selector, valores] of [[':root', temas.claro], ["[data-tema='oscuro']", temas.oscuro]]) {
        const regla = new Rule({ selector })
        for (const [nombre, { a, porcentaje, b }] of usadas) {
          if (!(a in valores)) throw new Error(`color-mix usa --${a}, que no está en tokens.css`)
          if (b !== 'transparent' && !(b in valores)) throw new Error(`color-mix usa --${b}, que no está en tokens.css`)
          const valorB = b === 'transparent' ? 'transparent' : valores[b]
          regla.append(new Declaration({ prop: nombre, value: mezclar(valores[a], porcentaje, valorB) }))
        }
        raiz.append(regla)
      }
    },
  }
}
mezclasDeColor.postcss = true
