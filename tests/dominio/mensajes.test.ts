import { describe, it, expect } from 'vitest'
import { mensajeCierre, mensajeCobro, mensajeCompra, enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import type { Cliente, Negocio, Producto, Venta } from '@/dominio/tipos'

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

  it('sin teléfono abre WhatsApp a elegir contacto, no un número roto', () => {
    expect(enlaceWhatsApp('', 'x')).toBe('https://wa.me/?text=x')
  })
})

const negocio: Negocio = {
  id: 'unico', nombre: 'Almacén Don José', logo: null, color: null,
}

const venta: Venta = {
  id: 'v1',
  fecha: new Date(2026, 7, 31, 21, 45).getTime(),
  total: 620000,
  medioPago: 'efectivo',
  items: [
    { productoId: 'p1', nombre: 'Coca 2L', cantidad: 2, precio: 250000, costo: 180000 },
    { productoId: 'p2', nombre: 'Pan', cantidad: 1, precio: 120000, costo: 60000 },
  ],
  clienteId: null,
}

describe('mensajeTicket', () => {
  it('arma el ticket con negocio, items, total y fecha', () => {
    const texto = mensajeTicket(negocio, venta)
    expect(texto).toContain('*Almacén Don José*')
    expect(texto).toContain('2 x Coca 2L — $5.000')
    expect(texto).toContain('1 x Pan — $1.200')
    expect(texto).toContain('*Total: $6.200*')
    expect(texto).toContain('21:45 — 31/08/2026')
    expect(texto).toContain('¡Gracias por tu compra!')
  })

  it('es texto corrido: no hay caracteres de tabla', () => {
    const texto = mensajeTicket(negocio, venta)
    expect(texto).not.toMatch(/[|]/)
    expect(texto).not.toMatch(/\t/)
  })

  it('una venta fiada avisa que quedó en la libreta', () => {
    const fiado = { ...venta, medioPago: 'fiado' as const }
    expect(mensajeTicket(negocio, fiado)).toContain('Quedó en la libreta: $6.200')
  })
})

describe('mensajeAcceso', () => {
  it('manda a la dirección donde está publicada la app, no a una fija', async () => {
    const { mensajeAcceso } = await import('@/dominio/mensajes')
    const texto = mensajeAcceso('5492615550000', '482913', 'https://libreta-drab.vercel.app')
    expect(texto).toContain('Teléfono: 5492615550000')
    expect(texto).toContain('PIN: 482913')
    expect(texto).toContain('https://libreta-drab.vercel.app')
    expect(texto).not.toContain('libreta-sepia')
  })
})
