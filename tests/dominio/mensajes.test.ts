import { describe, it, expect } from 'vitest'
import { mensajeCierre, mensajeCobro, mensajeCompra, enlaceWhatsApp } from '@/dominio/mensajes'
import type { Cliente, Producto } from '@/dominio/tipos'

const cliente: Cliente = { id: 'c1', nombre: 'Marta', telefono: '2615551234' }
const producto: Producto = {
  id: 'p1', codigoBarras: null, nombre: 'Yerba Playadito',
  costo: 300000, precio: 420000, stock: 2, stockMinimo: 3, actualizadoEn: 0,
}

describe('mensajeCobro', () => {
  it('saluda por el nombre y dice el saldo en pesos', () => {
    const texto = mensajeCobro(cliente, 520000, 12)
    expect(texto).toContain('Marta')
    expect(texto).toContain('$5.200')
  })

  it('no acusa ni amenaza: pide sin maltratar', () => {
    const texto = mensajeCobro(cliente, 520000, 40).toLowerCase()
    for (const palabra of ['deudor', 'urgente', 'inmediato', 'reclamo', 'legal']) {
      expect(texto).not.toContain(palabra)
    }
  })

  it('menciona desde cuándo viene la cuenta', () => {
    expect(mensajeCobro(cliente, 520000, 12)).toContain('12 días')
  })

  it('en singular escribe "1 día", no "1 días"', () => {
    expect(mensajeCobro(cliente, 100000, 1)).toContain('1 día')
    expect(mensajeCobro(cliente, 100000, 1)).not.toContain('1 días')
  })
})

describe('mensajeCompra', () => {
  it('lista cada producto con la cantidad sugerida', () => {
    const texto = mensajeCompra([{ producto, diasRestantes: 2, cantidadSugerida: 6 }])
    expect(texto).toContain('Yerba Playadito')
    expect(texto).toContain('6')
  })

  it('con la lista vacía avisa que no hace falta comprar', () => {
    expect(mensajeCompra([])).toContain('No hace falta')
  })
})

describe('mensajeCierre', () => {
  const resumen = { vendido: 770000, ganancia: 210000, contado: 500000, diferencia: 0 }

  it('resume el día con los importes en pesos', () => {
    const texto = mensajeCierre(resumen)
    expect(texto).toContain('$7.700')
    expect(texto).toContain('$2.100')
  })

  it('cuando cuadra lo dice con tranquilidad, sin hablar de errores', () => {
    const texto = mensajeCierre(resumen).toLowerCase()
    expect(texto).toContain('cuadró')
    for (const palabra of ['error', 'falta', 'problema']) {
      expect(texto).not.toContain(palabra)
    }
  })

  it('cuando falta plata lo dice sin acusar', () => {
    const texto = mensajeCierre({ ...resumen, diferencia: -2000 })
    expect(texto).toContain('Faltó $20')
  })

  it('cuando sobra también se cuenta', () => {
    const texto = mensajeCierre({ ...resumen, diferencia: 2000 })
    expect(texto).toContain('Sobró $20')
  })
})

describe('enlaceWhatsApp', () => {
  it('arma el enlace con el código de país argentino y el texto codificado', () => {
    const enlace = enlaceWhatsApp('2615551234', 'Hola Marta')
    expect(enlace).toBe('https://wa.me/542615551234?text=Hola%20Marta')
  })

  it('limpia espacios, guiones y paréntesis del teléfono', () => {
    expect(enlaceWhatsApp('(261) 555-1234', 'x')).toContain('wa.me/542615551234')
  })

  it('no vuelve a agregar el código de país si ya lo tiene', () => {
    expect(enlaceWhatsApp('542615551234', 'x')).toContain('wa.me/542615551234')
  })
})
