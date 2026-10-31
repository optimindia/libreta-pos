import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'

const base = { codigoBarras: null, costo: 100, precio: 200, stock: 1, stockMinimo: 0 }

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.productos.guardar({ ...base, nombre: 'Yerba', categoria: 'Almacen' })
  await repos.productos.guardar({ ...base, nombre: 'Arroz', categoria: 'Almacen' })
  await repos.productos.guardar({ ...base, nombre: 'Coca', categoria: 'Bebidas' })
  await repos.productos.guardar({ ...base, nombre: 'Pila' })
})

describe('categorías', () => {
  it('lista las categorías en uso con su cantidad', async () => {
    expect(await repos.productos.categorias()).toEqual([{ nombre: 'Almacen', cantidad: 2 }, { nombre: 'Bebidas', cantidad: 1 }])
  })

  it('renombrar cambia todos los productos de esa categoría', async () => {
    expect(await repos.productos.renombrarCategoria('Almacen', 'Almacén')).toBe(2)
    expect(await repos.productos.categorias()).toEqual([{ nombre: 'Almacén', cantidad: 2 }, { nombre: 'Bebidas', cantidad: 1 }])
  })

  it('renombrar a una que ya existe las junta', async () => {
    await repos.productos.renombrarCategoria('Bebidas', 'Almacen')
    expect(await repos.productos.categorias()).toEqual([{ nombre: 'Almacen', cantidad: 3 }])
  })

  it('quitarla deja los productos sin categoría, sin borrarlos', async () => {
    await repos.productos.renombrarCategoria('Bebidas', '')
    expect(await repos.productos.categorias()).toEqual([{ nombre: 'Almacen', cantidad: 2 }])
    expect(await repos.productos.todos()).toHaveLength(4)
  })
})
