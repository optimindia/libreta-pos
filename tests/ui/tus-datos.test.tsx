import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { crearRespaldoLocal } from '@/datos/local/respaldo'
import { TusDatos } from '@/ui/config/TusDatos'

const descargas: { nombre: string; contenido: string; tipo: string }[] = []
vi.mock('@/datos/local/descarga', () => ({
  descargarArchivo: (nombre: string, contenido: string, tipo: string) => { descargas.push({ nombre, contenido, tipo }) },
}))

function archivoConTexto(texto: string) {
  const archivo = new File([texto], 'copia.json', { type: 'application/json' })
  Object.defineProperty(archivo, 'text', { value: () => Promise.resolve(texto) })
  return archivo
}

async function subir(texto: string) {
  const entrada = await screen.findByLabelText('Archivo de respaldo')
  fireEvent.change(entrada, { target: { files: [archivoConTexto(texto)] } })
}

const producto = (id: string, nombre: string, actualizadoEn = 1) =>
  ({ id, codigoBarras: null, nombre, costo: 100, precio: 200, stock: 1, stockMinimo: 0, actualizadoEn })

beforeEach(async () => {
  descargas.length = 0
  await db.delete()
  await db.open()
  await db.negocio.put({ id: 'unico', nombre: 'Mi almacén', logo: null, color: null, rol: 'dueno' })
})

describe('Tus datos', () => {
  it('no se muestra a un vendedor', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'X', logo: null, color: null, rol: 'vendedor' })
    render(<TusDatos />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Tus datos')).toBeNull()
    expect(screen.queryByRole('button', { name: /descargar ventas/i })).toBeNull()
  })

  it('el dueño ve las tres descargas y la copia, sin un solo botón principal', async () => {
    render(<TusDatos />)
    expect(await screen.findByRole('button', { name: /descargar ventas \(csv\)/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /descargar productos \(csv\)/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /descargar fiados \(csv\)/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /descargar copia/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /restaurar copia/i })).toBeTruthy()
    expect(document.querySelectorAll('[data-variante="principal"]').length).toBe(0)
  })

  it('descarga ventas en el rango pedido, formato argentino', async () => {
    await db.clientes.put({ id: 'c1', nombre: 'Ana', telefono: null })
    await db.ventas.bulkPut([
      { id: 'v1', fecha: Date.UTC(2026, 2, 1, 15, 0), total: 150050, medioPago: 'efectivo', clienteId: 'c1', items: [{ productoId: 'p', nombre: 'Yerba', cantidad: 1, precio: 150050, costo: 1 }] },
      { id: 'v2', fecha: Date.UTC(2026, 2, 10, 15, 0), total: 100, medioPago: 'qr', clienteId: null, items: [] },
    ])
    render(<TusDatos />)
    fireEvent.change(await screen.findByLabelText('Ventas desde'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('Ventas hasta'), { target: { value: '2026-03-02' } })
    fireEvent.click(screen.getByRole('button', { name: /descargar ventas/i }))
    await waitFor(() => expect(descargas).toHaveLength(1))
    expect(descargas[0].nombre).toMatch(/^libreta-ventas-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(descargas[0].contenido.startsWith('﻿')).toBe(true)
    expect(descargas[0].contenido).toContain('01/03/2026 12:00;Efectivo;1500,50;Completada;1 x Yerba;Ana')
    expect(descargas[0].contenido).not.toContain(';v2')
  })

  it('avisa si el rango es inválido y si no hay ventas', async () => {
    render(<TusDatos />)
    fireEvent.change(await screen.findByLabelText('Ventas desde'), { target: { value: '2026-03-05' } })
    fireEvent.change(screen.getByLabelText('Ventas hasta'), { target: { value: '2026-03-01' } })
    fireEvent.click(screen.getByRole('button', { name: /descargar ventas/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Revisá las fechas/)
    fireEvent.change(screen.getByLabelText('Ventas hasta'), { target: { value: '2026-03-09' } })
    fireEvent.click(screen.getByRole('button', { name: /descargar ventas/i }))
    expect((await screen.findByRole('status')).textContent).toMatch(/No hay ventas/)
    expect(descargas).toHaveLength(0)
  })

  it('descarga productos y fiados', async () => {
    await db.productos.put(producto('p1', 'Yerba'))
    await db.clientes.put({ id: 'c1', nombre: 'Ana', telefono: null })
    await db.fiados.put({ id: 'f1', clienteId: 'c1', ventaId: null, monto: 5000, fecha: Date.UTC(2026, 0, 5, 15, 0), vence: null })
    render(<TusDatos />)
    fireEvent.click(await screen.findByRole('button', { name: /descargar productos/i }))
    await waitFor(() => expect(descargas).toHaveLength(1))
    expect(descargas[0].contenido).toContain('Yerba;;;1,00;2,00;1;0')
    fireEvent.click(screen.getByRole('button', { name: /descargar fiados/i }))
    await waitFor(() => expect(descargas).toHaveLength(2))
    expect(descargas[1].contenido).toContain('Ana;05/01/2026 12:00;;50,00;0,00;50,00;Pendiente')
  })

  it('descarga la copia completa en JSON', async () => {
    await db.productos.put(producto('p1', 'Yerba'))
    render(<TusDatos />)
    fireEvent.click(await screen.findByRole('button', { name: /descargar copia/i }))
    await waitFor(() => expect(descargas).toHaveLength(1))
    expect(descargas[0].tipo).toBe('application/json')
    expect(JSON.parse(descargas[0].contenido)).toMatchObject({ version: 2, esquema: db.verno })
  })

  it('rechaza un archivo corrupto sin cambiar nada', async () => {
    render(<TusDatos />)
    await subir('esto no es json')
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es una copia de Libreta o está dañado/)
    expect(screen.queryByRole('group', { name: /resumen/i })).toBeNull()
  })

  it('rechaza una copia de versión futura', async () => {
    render(<TusDatos />)
    await subir(JSON.stringify({ version: 99, creadoEn: 1 }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/versión más nueva/)
  })

  it('muestra el resumen, pide confirmación y restaura sin borrar lo existente', async () => {
    const copia = await crearRespaldoLocal()
    copia.productos = [producto('nuevo', 'Del backup')] as never
    await db.productos.put(producto('local', 'Local'))
    render(<TusDatos />)
    await subir(JSON.stringify(copia))
    const resumen = await screen.findByRole('group', { name: /resumen de la copia/i })
    expect(resumen.textContent).toMatch(/Productos: 1/)
    expect(await db.productos.get('nuevo')).toBeUndefined() // todavía no restauró
    fireEvent.click(screen.getByRole('button', { name: /sí, restaurar/i }))
    await waitFor(async () => expect((await db.productos.get('nuevo'))?.nombre).toBe('Del backup'))
    expect((await db.productos.get('local'))?.nombre).toBe('Local')
    expect((await screen.findByRole('status')).textContent).toMatch(/Lo que ya tenías quedó intacto/)
  })

  it('cancelar no cambia nada; borrar el resto exige tildar y confirmar', async () => {
    const copia = await crearRespaldoLocal()
    copia.productos = [producto('nuevo', 'Del backup')] as never
    await db.productos.put(producto('local', 'Local'))
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TusDatos />)
    await subir(JSON.stringify(copia))
    fireEvent.click(await screen.findByLabelText(/también borrar lo que no esté en la copia/i))
    const boton = await screen.findByRole('button', { name: /restaurar y borrar el resto/i })
    fireEvent.click(boton)
    expect(confirmar).toHaveBeenCalled()
    expect(await db.productos.count()).toBe(1)
    confirmar.mockReturnValue(true)
    fireEvent.click(boton)
    await waitFor(async () => expect(await db.productos.get('local')).toBeUndefined())
    expect((await db.productos.get('nuevo'))?.nombre).toBe('Del backup')
    confirmar.mockRestore()
  })

  it('cancelar descarta la copia leída', async () => {
    const copia = await crearRespaldoLocal()
    render(<TusDatos />)
    await subir(JSON.stringify(copia))
    fireEvent.click(await screen.findByRole('button', { name: /cancelar/i }))
    expect(screen.queryByRole('group', { name: /resumen/i })).toBeNull()
  })
})
