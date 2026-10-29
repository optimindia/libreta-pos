// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'supabase/migrations'
const archivo = readdirSync(dir).find((n) => /^20261029120000_.*\.sql$/.test(n))
const archivoPoliticas = readdirSync(dir).find((n) => /^20261029120100_.*\.sql$/.test(n))

describe('migración FUN-04/FUN-05', () => {
  it('existe y es aditiva: sin borrar ni tocar datos', () => {
    expect(archivo).toBeTruthy()
    const sql = readFileSync(`${dir}/${archivo}`, 'utf8')
    // Lo ejecutable (sin comentarios de reversión).
    const vivo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase()
    expect(vivo).not.toMatch(/drop\s+(table|column)/)
    expect(vivo).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\.\w+\s+set\b/)
    for (const t of ['ventas', 'fiado_pagos', 'cierres']) {
      expect(vivo).toMatch(new RegExp(`alter table public\\.${t}[\\s\\S]*?add column if not exists`))
    }
    expect(vivo).toMatch(/vendido_por uuid/)
    expect(vivo).toMatch(/usuario_id uuid/)
    expect(vivo).toMatch(/alcance text/)
    expect(vivo).not.toMatch(/add column[^;]*not null/)
  })
  it('deja al vendedor cerrar SU turno y nada más en cierres, y trae el SQL para revertir', () => {
    expect(archivoPoliticas).toBeTruthy()
    const sql = readFileSync(`${dir}/${archivoPoliticas}`, 'utf8')
    expect(sql).toMatch(/alcance = 'turno'/)
    expect(sql).toMatch(/usuario_id = \(select auth\.uid\(\)\)/)
    expect(sql).toMatch(/-- Para revertir/i)
  })
})
