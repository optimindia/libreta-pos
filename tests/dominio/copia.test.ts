import { describe, expect, it } from 'vitest'
import {
  VERSION_COPIA, ESQUEMA_ACTUAL, interpretarCopia, resumirCopia, planificarFusion, type Copia,
} from '@/dominio/copia'

const base = {
  version: VERSION_COPIA, esquema: ESQUEMA_ACTUAL, creadoEn: 1700000000000,
  productos: [{ id: 'p1', nombre: 'Fideos', precio: 100, costo: 50, stock: 1, stockMinimo: 0, codigoBarras: null, actualizadoEn: 10 }],
  ventas: [], clientes: [], fiados: [], fiadoPagos: [], ingresos: [], cierres: [],
  movimientosCaja: [], pedidos: [], preferencias: [],
  negocio: [{ id: 'unico', nombre: 'X', logo: null, color: null }],
}

function leer(valor: unknown): Copia {
  const r = interpretarCopia(JSON.stringify(valor))
  if (!r.ok) throw new Error(`no se pudo leer: ${r.motivo}`)
  return r.copia
}

describe('interpretarCopia', () => {
  it('round-trip: lo que se serializa se vuelve a leer igual', () => {
    expect(leer(base)).toEqual(base)
  })
  it('acepta copias viejas (versión 1, sin esquema ni movimientos)', () => {
    const { esquema: _e, movimientosCaja: _m, ...vieja } = base
    void _e; void _m
    expect(interpretarCopia(JSON.stringify({ ...vieja, version: 1 })).ok).toBe(true)
  })
  it('rechaza archivos que no son JSON', () => {
    expect(interpretarCopia('esto no es json {')).toMatchObject({ ok: false, motivo: 'corrupto' })
  })
  it('rechaza JSON que no es una copia', () => {
    expect(interpretarCopia('[]')).toMatchObject({ ok: false, motivo: 'corrupto' })
    expect(interpretarCopia('null')).toMatchObject({ ok: false, motivo: 'corrupto' })
    expect(interpretarCopia('{"hola":1}')).toMatchObject({ ok: false, motivo: 'corrupto' })
  })
  it('rechaza versión futura con un motivo propio', () => {
    expect(interpretarCopia(JSON.stringify({ ...base, version: VERSION_COPIA + 1 }))).toMatchObject({ ok: false, motivo: 'version-futura' })
  })
  it('rechaza esquema de base más nuevo que el de esta app', () => {
    expect(interpretarCopia(JSON.stringify({ ...base, esquema: ESQUEMA_ACTUAL + 1 }))).toMatchObject({ ok: false, motivo: 'version-futura' })
  })
  it('rechaza tablas con filas sin id o con campos clave rotos', () => {
    expect(interpretarCopia(JSON.stringify({ ...base, productos: [{ nombre: 'sin id' }] })).ok).toBe(false)
    expect(interpretarCopia(JSON.stringify({ ...base, productos: [{ id: 'a', nombre: 'x', precio: 'mucho' }] })).ok).toBe(false)
    expect(interpretarCopia(JSON.stringify({ ...base, ventas: [{ id: 'v', fecha: 1, total: 5, items: 'nada' }] })).ok).toBe(false)
    expect(interpretarCopia(JSON.stringify({ ...base, ventas: 'no es lista' })).ok).toBe(false)
  })
  it('rechaza ids duplicados dentro de una tabla', () => {
    const p = base.productos[0]
    expect(interpretarCopia(JSON.stringify({ ...base, productos: [p, p] })).ok).toBe(false)
  })
})

describe('resumirCopia y planificarFusion', () => {
  const copia = leer({
    ...base,
    productos: [
      { ...base.productos[0], id: 'nuevo' },
      { ...base.productos[0], id: 'viejo', actualizadoEn: 5, nombre: 'Del backup' },
      { ...base.productos[0], id: 'mas-nuevo', actualizadoEn: 50, nombre: 'Del backup' },
    ],
  })

  it('cuenta registros por tabla', () => {
    const resumen = resumirCopia(copia)
    expect(resumen.find((f) => f.tabla === 'productos')?.cantidad).toBe(3)
  })
  it('fusiona por id: agrega lo nuevo y no pisa lo más reciente del aparato', () => {
    const actual = {
      productos: [
        { id: 'viejo', actualizadoEn: 20 },
        { id: 'mas-nuevo', actualizadoEn: 20 },
        { id: 'solo-aca', actualizadoEn: 1 },
      ],
    }
    const p = planificarFusion(copia, actual).tablas.productos
    expect(p.agregar.map((f) => f.id)).toEqual(['nuevo'])
    expect(p.actualizar.map((f) => f.id)).toEqual(['mas-nuevo'])
    expect(p.conservar).toEqual(['viejo'])
    expect(p.borrar).toEqual([]) // sin reemplazo no se borra nada
  })
  it('con reemplazo explícito marca para borrar lo que no está en la copia', () => {
    const plan = planificarFusion(copia, { productos: [{ id: 'solo-aca' }] }, { reemplazar: true })
    expect(plan.tablas.productos.borrar).toEqual(['solo-aca'])
  })
  it('donde no hay marca de tiempo, gana lo que ya está en el aparato', () => {
    const c = leer({ ...base, ventas: [{ id: 'v1', fecha: 1, total: 5, items: [], estado: 'completada' }] })
    const v = planificarFusion(c, { ventas: [{ id: 'v1' }] }).tablas.ventas
    expect(v.conservar).toEqual(['v1'])
    expect(v.actualizar).toEqual([])
  })
})
