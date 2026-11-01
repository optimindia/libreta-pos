// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/ui/ticket/ticket.css', 'utf8')
const layout = readFileSync('src/app/layout.tsx', 'utf8')
const bloquePrint = css.slice(css.indexOf('@media print'))

describe('estilos de impresión del ticket', () => {
  it('define la página de 58 mm', () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*58mm auto/)
  })

  it('usa márgenes mínimos', () => {
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*2mm/)
  })

  it('al imprimir esconde todo menos el ticket', () => {
    expect(bloquePrint).toMatch(/body > \*:not\(\.f-ticket-impreso\)\s*\{[^}]*display:\s*none\s*!important/)
    expect(bloquePrint).toMatch(/\.f-ticket-impreso\s*\{[^}]*display:\s*block\s*!important/)
  })

  it('en pantalla el ticket no se ve', () => {
    expect(css.slice(0, css.indexOf('@media print'))).toMatch(/\.f-ticket-impreso\s*\{\s*display:\s*none/)
  })

  it('usa fuente monoespaciada y no pinta fondos en el ticket', () => {
    expect(bloquePrint).toMatch(/font-family:[^;]*monospace/)
    expect(bloquePrint).toMatch(/\.f-ticket-impreso \*\s*\{[^}]*background:\s*none\s*!important/)
    const bloquesDelTicket = bloquePrint.match(/\.f-ticket-impreso[^{]*\{[^}]*\}/g) ?? []
    expect(bloquesDelTicket.length).toBeGreaterThan(0)
    for (const bloque of bloquesDelTicket) expect(bloque).not.toMatch(/background(-color)?:\s*(#|rgb|var)/)
  })

  it('el ticket se ve al imprimir aunque la impresión del PIN esconda todo', () => {
    expect(bloquePrint).toMatch(/\.f-ticket-impreso,\s*\.f-ticket-impreso \*\s*\{[^}]*visibility:\s*visible\s*!important/)
  })

  it('la impresión sale clara aunque la app esté en tema oscuro', () => {
    expect(bloquePrint).toMatch(/color-scheme:\s*light\s*!important/)
    expect(bloquePrint).toMatch(/html\s*\{[^}]*background:\s*#fff\s*!important/)
  })

  it('no usa color-mix y la hoja está cargada en el layout', () => {
    expect(css).not.toContain('color-mix')
    expect(layout).toContain('ui/ticket/ticket.css')
  })
})
