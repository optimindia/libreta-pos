// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'supabase/migrations'
const nombre = readdirSync(dir).find((n) => /^20261030120000_recuperacion_pin\.sql$/.test(n))
const sql = nombre ? readFileSync(`${dir}/${nombre}`, 'utf8') : ''
const vivo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase()

describe('migración SEG-04 (recuperación del PIN)', () => {
  it('existe con el nombre pedido', () => {
    expect(nombre).toBe('20261030120000_recuperacion_pin.sql')
  })

  it('es aditiva: no borra, no trunca y no toca filas existentes', () => {
    expect(vivo).not.toMatch(/\bdrop\s+/)
    expect(vivo).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\.\w+\s+set\b/)
    expect(vivo).toMatch(/create table if not exists public\.recuperacion_pin_codigos/)
    expect(vivo).toMatch(/add column if not exists debe_cambiar_pin boolean not null default false/)
  })

  it('guarda el hash del código y nunca el código', () => {
    expect(vivo).toMatch(/codigo_hash text not null/)
    expect(vivo).not.toMatch(/\bcodigo text\b/)
    expect(vivo).toMatch(/usado_en timestamptz/)
  })

  it('la tabla queda cerrada: RLS forzada, sin políticas y sin permisos para el navegador', () => {
    expect(vivo).toMatch(/alter table public\.recuperacion_pin_codigos enable row level security/)
    expect(vivo).toMatch(/alter table public\.recuperacion_pin_codigos force row level security/)
    expect(vivo).toMatch(/revoke all on table public\.recuperacion_pin_codigos from public, anon, authenticated/)
    expect(vivo).toMatch(/grant [a-z, ]+ on table public\.recuperacion_pin_codigos to service_role/)
    expect(vivo).not.toMatch(/create policy/)
    expect(vivo).not.toMatch(/grant [a-z, ]+ on table public\.recuperacion_pin_codigos to (anon|authenticated|public)/)
  })

  it('el navegador no recibe permiso de escritura sobre usuarios_negocio', () => {
    expect(vivo).not.toMatch(/grant [a-z, ]+ on table public\.usuarios_negocio/)
  })

  it('trae comentado el SQL para revertir, y lo revierte todo', () => {
    expect(sql).toMatch(/-- Para revertir/i)
    expect(sql).toMatch(/--\s+alter table public\.usuarios_negocio drop column if exists debe_cambiar_pin;/)
    expect(sql).toMatch(/--\s+drop table if exists public\.recuperacion_pin_codigos;/)
  })
})
