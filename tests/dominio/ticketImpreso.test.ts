import { describe, expect, it } from 'vitest'
import {
  fechaHoraArgentina,
  normalizarPreferenciasTicket,
  resumenTicket,
  textoPlanoTicket,
  COLUMNAS,
  type DatosTicket,
} from '@/dominio/ticketImpreso'

// 29/10/2026 17:05 UTC = 14:05 en Argentina (UTC-3, sin horario de verano).
const FECHA = Date.UTC(2026, 9, 29, 17, 5)

const datos = (extra: Partial<DatosTicket> = {}): DatosTicket => ({
  negocio: 'Almacén Rosales',
  venta: {
    fecha: FECHA,
    total: 125050,
    medioPago: 'efectivo',
    items: [
      { productoId: 'a', nombre: 'Yerba Playadito', cantidad: 2, precio: 420000, costo: 300000 },
      { productoId: 'b', nombre: 'Queso cremoso', cantidad: 0.333, precio: 100000, costo: 50000 },
    ],
  },
  leyenda: 'Gracias por tu compra',
  ...extra,
})

describe('fechaHoraArgentina', () => {
  it('usa el horario de Argentina sin importar la zona del aparato', () => {
    expect(fechaHoraArgentina(FECHA)).toBe('29/10/2026 14:05')
  })

  it('en la madrugada UTC todavía es el día anterior', () => {
    expect(fechaHoraArgentina(Date.UTC(2026, 0, 1, 1, 30))).toBe('31/12/2025 22:30')
  })
})

describe('resumenTicket', () => {
  it('formatea importes con formatearPesos y redondea al centavo', () => {
    const r = resumenTicket(datos())
    expect(r.renglones[0]).toEqual({ cantidad: '2', nombre: 'Yerba Playadito', importe: '$8.400' })
    // 0,333 x $1.000 = $333 (33300 centavos), sin fracciones
    expect(r.renglones[1].importe).toBe('$333')
    expect(r.total).toBe('$1.250,50')
  })

  it('calcula el vuelto sólo en efectivo y cuando se conoce con cuánto pagó', () => {
    expect(resumenTicket(datos({ pagoCon: 150000 })).vuelto).toBe('$249,50')
    expect(resumenTicket(datos()).vuelto).toBeNull()
    expect(resumenTicket(datos({ pagoCon: 100000 })).vuelto).toBeNull()
    const digital = datos({ pagoCon: 200000 })
    digital.venta.medioPago = 'transferencia'
    expect(resumenTicket(digital).vuelto).toBeNull()
    expect(resumenTicket(digital).medioPago).toBe('Transferencia')
  })

  it('sin nombre usa "Tu almacén" y el vendedor es opcional', () => {
    expect(resumenTicket(datos({ negocio: '  ' })).negocio).toBe('Tu almacén')
    expect(resumenTicket(datos()).vendedor).toBeNull()
    expect(resumenTicket(datos({ vendedor: 'Lucía' })).vendedor).toBe('Lucía')
  })
})

describe('textoPlanoTicket', () => {
  it('trae negocio, fecha, renglones, total, pago, vuelto, vendedor y leyenda', () => {
    const texto = textoPlanoTicket(datos({ pagoCon: 150000, vendedor: 'Lucía' }))
    for (const parte of ['Almacén Rosales', '29/10/2026 14:05', '2 x Yerba Playadito', '$8.400', 'TOTAL', '$1.250,50', 'Efectivo', 'Vuelto', '$249,50', 'Lucía', 'Gracias por tu compra']) {
      expect(texto).toContain(parte)
    }
  })

  it('ningún renglón pasa del ancho del rollo', () => {
    for (const ancho of [58, 80] as const) {
      const lineas = textoPlanoTicket(datos({ negocio: 'Almacén y Despensa Don José de la Esquina', leyenda: 'Gracias por tu compra, vuelva pronto', vendedor: 'Vendedor con un nombre larguísimo' }), ancho).split('\n')
      for (const linea of lineas) expect(linea.length).toBeLessThanOrEqual(COLUMNAS[ancho])
    }
  })

  it('sin leyenda no deja el pie vacío', () => {
    expect(textoPlanoTicket(datos({ leyenda: '  ' })).trimEnd().endsWith('Efectivo')).toBe(true)
  })
})

describe('normalizarPreferenciasTicket', () => {
  it('lo roto vuelve a 58 mm y la leyenda de siempre', () => {
    expect(normalizarPreferenciasTicket(null)).toEqual({ ancho: 58, leyenda: 'Gracias por tu compra' })
    expect(normalizarPreferenciasTicket({ ancho: 100, leyenda: 4 })).toEqual({ ancho: 58, leyenda: 'Gracias por tu compra' })
  })

  it('respeta 80 mm y una leyenda vacía', () => {
    expect(normalizarPreferenciasTicket({ ancho: 80, leyenda: '' })).toEqual({ ancho: 80, leyenda: '' })
  })
})
