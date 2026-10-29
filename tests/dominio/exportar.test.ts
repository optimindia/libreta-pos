import { describe, expect, it } from 'vitest'
import {
  armarCsv, escaparCelda, fechaArgentina, decimalArgentino, rangoDeDiasArgentina,
  csvVentas, csvProductos, csvFiados, nombreArchivoCsv,
} from '@/dominio/exportar'
import type { Cliente, Fiado, FiadoPago, Producto, Venta } from '@/dominio/tipos'

describe('escaparCelda', () => {
  it('deja pasar texto simple', () => {
    expect(escaparCelda('Yerba')).toBe('Yerba')
  })
  it('entrecomilla separador, comillas y saltos de línea, duplicando las comillas', () => {
    expect(escaparCelda('a;b')).toBe('"a;b"')
    expect(escaparCelda('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(escaparCelda('uno\ndos')).toBe('"uno\ndos"')
    expect(escaparCelda('uno\r\ndos')).toBe('"uno\r\ndos"')
  })
  it('neutraliza fórmulas (inyección CSV) anteponiendo un apóstrofo', () => {
    expect(escaparCelda('=SUMA(A1:A2)')).toBe("'=SUMA(A1:A2)")
    expect(escaparCelda('+54 9 261')).toBe("'+54 9 261")
    expect(escaparCelda('-1+1')).toBe("'-1+1")
    expect(escaparCelda('@cmd')).toBe("'@cmd")
    expect(escaparCelda('\t=1')).toBe("'\t=1")
    expect(escaparCelda('  =1+1')).toBe("'  =1+1")
    expect(escaparCelda('=HYPERLINK("http://x";"y")')).toBe(`"'=HYPERLINK(""http://x"";""y"")"`)
  })
  it('no toca un signo en el medio ni los números', () => {
    expect(escaparCelda('a=b')).toBe('a=b')
    expect(escaparCelda(-5)).toBe('-5')
    expect(escaparCelda(null)).toBe('')
    expect(escaparCelda(undefined)).toBe('')
  })
})

describe('formatos argentinos', () => {
  it('fecha dd/mm/aaaa hh:mm en horario de Argentina (UTC-3)', () => {
    expect(fechaArgentina(Date.UTC(2026, 0, 5, 15, 7))).toBe('05/01/2026 12:07')
    // Cruce de día: 01:30 UTC del 6 es 22:30 del 5 en Argentina.
    expect(fechaArgentina(Date.UTC(2026, 0, 6, 1, 30))).toBe('05/01/2026 22:30')
    expect(fechaArgentina(Date.UTC(2026, 11, 31, 23, 59))).toBe('31/12/2026 20:59')
  })
  it('importes con coma decimal y sin separador de miles', () => {
    expect(decimalArgentino(420050)).toBe('4200,50')
    expect(decimalArgentino(5)).toBe('0,05')
    expect(decimalArgentino(-1250)).toBe('-12,50')
    expect(decimalArgentino(0)).toBe('0,00')
    expect(decimalArgentino(123456789)).toBe('1234567,89')
  })
  it('rango de días: inclusive, en horario argentino', () => {
    const rango = rangoDeDiasArgentina('2026-03-01', '2026-03-02')
    expect(rango).toEqual({ desde: Date.UTC(2026, 2, 1, 3, 0, 0), hasta: Date.UTC(2026, 2, 3, 3, 0, 0) - 1 })
  })
  it('rango abierto o inválido', () => {
    expect(rangoDeDiasArgentina('', '')).toEqual({ desde: -Infinity, hasta: Infinity })
    expect(rangoDeDiasArgentina('2026-03-05', '2026-03-01')).toBeNull()
    expect(rangoDeDiasArgentina('basura', '')).toBeNull()
    expect(rangoDeDiasArgentina('2026-02-31', '')).toBeNull()
  })
})

describe('armarCsv', () => {
  it('usa ; , CRLF y BOM UTF-8', () => {
    expect(armarCsv([['a', 'b'], ['1', 'x;y']])).toBe('﻿a;b\r\n1;"x;y"\r\n')
  })
})

describe('csvVentas', () => {
  const venta: Venta = {
    id: 'v1', fecha: Date.UTC(2026, 0, 5, 15, 7), total: 420050, medioPago: 'efectivo', clienteId: 'c1',
    items: [{ productoId: 'p', nombre: '=Yerba "premium"', cantidad: 2, precio: 210025, costo: 150000 }],
  }
  const clientes: Cliente[] = [{ id: 'c1', nombre: 'Ana; Gómez', telefono: null }]

  it('exporta encabezado, fecha, total con coma y detalle escapado', () => {
    const lineas = csvVentas([venta], clientes).replace('﻿', '').split('\r\n')
    expect(lineas[0]).toBe('Fecha;Medio de pago;Total;Estado;Productos;Cliente;Motivo de anulación;Referencia de pago;ID')
    expect(lineas[1]).toBe('05/01/2026 12:07;Efectivo;4200,50;Completada;"2 x =Yerba ""premium""";"Ana; Gómez";;;v1')
  })
  it('marca anuladas y ordena de la más nueva a la más vieja', () => {
    const vieja: Venta = { ...venta, id: 'v0', fecha: 1000, estado: 'anulada', motivoAnulacion: 'Error' }
    const lineas = csvVentas([vieja, venta], clientes).split('\r\n')
    expect(lineas[1]).toContain(';v1')
    expect(lineas[2]).toContain('Anulada')
    expect(lineas[2]).toContain('Error')
  })
})

describe('csvProductos', () => {
  const base: Producto = { id: 'p1', codigoBarras: '779', nombre: 'Yerba', costo: 30000, precio: 42000, stock: 5, stockMinimo: 2, categoria: 'Almacén', actualizadoEn: 0 }
  it('exporta importes con coma y oculta los eliminados', () => {
    const csv = csvProductos([base, { ...base, id: 'p2', nombre: 'Borrado', eliminadoEn: 5 }])
    const lineas = csv.replace('﻿', '').split('\r\n')
    expect(lineas[0]).toBe('Nombre;Código de barras;Categoría;Costo;Precio;Stock;Stock mínimo')
    expect(lineas[1]).toBe('Yerba;779;Almacén;300,00;420,00;5;2')
    expect(lineas).toHaveLength(3) // encabezado + 1 + fin vacío
  })
})

describe('csvFiados', () => {
  it('calcula pagado, saldo y estado', () => {
    const clientes: Cliente[] = [{ id: 'c1', nombre: 'Ana', telefono: null }]
    const fiados: Fiado[] = [
      { id: 'f1', clienteId: 'c1', ventaId: null, monto: 100000, fecha: Date.UTC(2026, 0, 5, 15, 0), vence: null },
      { id: 'f2', clienteId: 'c1', ventaId: null, monto: 5000, fecha: Date.UTC(2026, 0, 6, 15, 0), vence: Date.UTC(2026, 1, 1, 15, 0) },
    ]
    const pagos: FiadoPago[] = [{ id: 'g', fiadoId: 'f2', monto: 5000, fecha: 1 }]
    const lineas = csvFiados(fiados, pagos, clientes).replace('﻿', '').split('\r\n')
    expect(lineas[0]).toBe('Cliente;Fecha;Vence;Monto;Pagado;Saldo;Estado')
    expect(lineas[1]).toBe('Ana;05/01/2026 12:00;;1000,00;0,00;1000,00;Pendiente')
    expect(lineas[2]).toBe('Ana;06/01/2026 12:00;01/02/2026 12:00;50,00;50,00;0,00;Pagado')
  })
})

describe('nombreArchivoCsv', () => {
  it('lleva la fecha argentina', () => {
    expect(nombreArchivoCsv('ventas', Date.UTC(2026, 0, 6, 1, 30))).toBe('libreta-ventas-2026-01-05.csv')
  })
})
