import { describe, it, expect, afterEach } from 'vitest'
import { soportaEscanerNativo } from '@/ui/vender/escaner'

afterEach(() => {
  delete (globalThis as Record<string, unknown>).BarcodeDetector
})

describe('soportaEscanerNativo', () => {
  it('es falso cuando el navegador no trae BarcodeDetector', () => {
    expect(soportaEscanerNativo()).toBe(false)
  })

  it('es verdadero cuando el navegador lo trae', () => {
    ;(globalThis as Record<string, unknown>).BarcodeDetector = class {}
    expect(soportaEscanerNativo()).toBe(true)
  })
})
