import { describe, it, expect } from 'vitest'
import { avisosPendientes, claveDia, type DatosAvisos } from '@/dominio/avisosLocales'
import { formatearPesos } from '@/dominio/dinero'
import { readFileSync } from 'node:fs'

const base: DatosAvisos = { porVencer: [], fiadosVencidos: { cantidad: 0, total: 0 }, cajaAbierta: false, reponer: [], cumpleHoy: [] }
const MANANA = new Date('2026-11-07T10:00:00').getTime()
const NOCHE = new Date('2026-11-07T21:30:00').getTime()

describe('avisos locales', () => {
  it('sin nada que hacer, no avisa nada', () => {
    expect(avisosPendientes(base, NOCHE, new Set(), formatearPesos)).toEqual([])
  })

  it('arma un aviso por tema y no repite lo avisado hoy', () => {
    const datos = { ...base, porVencer: ['Yogur', 'Leche'], fiadosVencidos: { cantidad: 2, total: 1500000 }, cumpleHoy: ['Marta'] }
    const avisos = avisosPendientes(datos, MANANA, new Set(), formatearPesos)
    expect(avisos.map((a) => a.id)).toEqual(['vencen', 'fiados', 'cumples'])
    expect(avisos[1].titulo).toBe('Fiados vencidos: $15.000')
    expect(avisosPendientes(datos, MANANA, new Set(['vencen', 'fiados']), formatearPesos).map((a) => a.id)).toEqual(['cumples'])
  })

  it('la caja recién se recuerda a la noche', () => {
    expect(avisosPendientes({ ...base, cajaAbierta: true }, MANANA, new Set(), formatearPesos)).toEqual([])
    expect(avisosPendientes({ ...base, cajaAbierta: true }, NOCHE, new Set(), formatearPesos)[0]).toMatchObject({ id: 'caja', url: '/plata' })
  })

  it('cada día es otra clave', () => {
    expect(claveDia(MANANA)).toBe(claveDia(NOCHE))
    expect(claveDia(MANANA + 86_400_000)).not.toBe(claveDia(MANANA))
  })

  it('el service worker abre la pantalla del aviso al tocarlo', () => {
    const sw = readFileSync('public/sw.js', 'utf8')
    expect(sw).toMatch(/addEventListener\('notificationclick'/)
    expect(sw).toMatch(/openWindow\(destino\)/)
  })
})
