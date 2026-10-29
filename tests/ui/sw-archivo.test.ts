// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sw = readFileSync('public/sw.js', 'utf8')

describe('public/sw.js (PWA-02)', () => {
  it('ya no se activa solo al instalarse: espera el mensaje de la pantalla', () => {
    const instalacion = sw.slice(sw.indexOf("'install'"), sw.indexOf("'message'"))
    expect(instalacion).not.toContain('skipWaiting')
  })

  it('se activa cuando la pantalla se lo pide con SKIP_WAITING', () => {
    expect(sw).toMatch(/addEventListener\('message'/)
    expect(sw).toContain('SKIP_WAITING')
    expect(sw).toContain('self.skipWaiting()')
  })
})
