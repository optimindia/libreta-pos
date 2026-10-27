import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('repos.movimientosCaja', () => {
  it('guarda, ordena, filtra y elimina movimientos', async () => {
    const guardado = await repos.movimientosCaja.registrar({ tipo: 'salida', concepto: '  Proveedor  ', monto: 125050, medioPago: 'efectivo' })
    expect(guardado.concepto).toBe('Proveedor')
    expect((await repos.movimientosCaja.entre(guardado.fecha - 1, guardado.fecha + 1))).toHaveLength(1)
    expect((await repos.movimientosCaja.todos())[0].monto).toBe(125050)
    await repos.movimientosCaja.eliminar(guardado.id)
    expect(await repos.movimientosCaja.todos()).toHaveLength(0)
  })
})
