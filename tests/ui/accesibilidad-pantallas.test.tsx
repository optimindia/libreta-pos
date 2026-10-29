import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { violacionesAxe } from './axe'
import { PantallaInicio } from '@/ui/inicio/PantallaInicio'
import { PantallaVender } from '@/ui/vender/PantallaVender'
import { PantallaFiados } from '@/ui/fiados/PantallaFiados'
import { PantallaStock } from '@/ui/stock/PantallaStock'
import { PantallaPlata } from '@/ui/plata/PantallaPlata'
import { PantallaPedidos } from '@/ui/pedidos/PantallaPedidos'
import { PantallaClientes } from '@/ui/clientes/PantallaClientes'
import { PantallaHistorial } from '@/ui/historial/PantallaHistorial'
import { PantallaConfig } from '@/ui/config/PantallaConfig'
import { PantallaCuenta } from '@/ui/cuenta/PantallaCuenta'
import { CentroPro } from '@/ui/pro/CentroPro'
import { Navegacion } from '@/ui/sistema/Navegacion'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {}, replace() {} }) }))
vi.mock('@/datos/nube/cliente', () => ({ cliente: null, nubeActiva: () => false }))

beforeEach(async () => {
  await db.delete()
  await db.open()
  window.localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: false, media: consulta, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

async function cargarDatos() {
  const yerba = await repos.productos.guardar({ codigoBarras: null, nombre: 'Yerba Playadito', costo: 300000, precio: 420000, stock: 10, stockMinimo: 3 })
  await repos.productos.guardar({ codigoBarras: null, nombre: 'Fideos', costo: 80000, precio: 148000, stock: 1, stockMinimo: 6 })
  const cliente = await repos.clientes.guardar({ nombre: 'Raúl', telefono: null })
  await db.fiados.add({ id: 'f1', clienteId: cliente.id, ventaId: null, monto: 2130000, fecha: Date.now() - 5e8, vence: Date.now() - 1e8 })
  await repos.ventas.registrar({ medioPago: 'efectivo', clienteId: null, items: [{ productoId: yerba.id, nombre: 'Yerba Playadito', cantidad: 1, precio: 420000, costo: 300000 }] })
}

const boton = (nombre: RegExp | string) => screen.findByRole('button', { name: nombre })
const abrirY = async (nombre: RegExp | string) => {
  fireEvent.click(await boton(nombre))
  return screen.findByRole('dialog')
}

type Hoja = { nombre: string; abrir: () => Promise<HTMLElement> }
type Caso = {
  nombre: string
  pantalla: () => React.JSX.Element
  /** Algo que sólo existe cuando los datos ya cargaron. */
  listo: () => Promise<unknown>
  /** Hojas que abre la pantalla: cada una se revisa abierta. */
  hojas?: Hoja[]
}

const CASOS: Caso[] = [
  { nombre: 'Inicio', pantalla: () => <PantallaInicio />, listo: () => screen.findByText('Fideos') },
  {
    nombre: 'Vender',
    pantalla: () => <PantallaVender />,
    listo: () => boton(/^Yerba Playadito/),
    hojas: [
      {
        nombre: 'cobro en efectivo',
        abrir: async () => {
          fireEvent.click(await boton(/^Yerba Playadito/))
          return abrirY(/^cobrar$/i)
        },
      },
      { nombre: 'cobro por transferencia', abrir: async () => { fireEvent.click(await screen.findByRole('radio', { name: /transferencia/i })); return screen.getByRole('dialog') } },
      { nombre: 'cobro con QR', abrir: async () => { fireEvent.click(await screen.findByRole('radio', { name: /^qr/i })); return screen.getByRole('dialog') } },
      { nombre: 'cobro a fiado', abrir: async () => { fireEvent.click(await screen.findByRole('radio', { name: /^fiado$/i })); return screen.getByRole('dialog') } },
    ],
  },
  {
    nombre: 'Fiados',
    pantalla: () => <PantallaFiados />,
    listo: () => screen.findAllByText('Raúl'),
    hojas: [{ nombre: 'nuevo cliente', abrir: () => abrirY(/\+ Cliente/) }],
  },
  {
    nombre: 'Stock',
    pantalla: () => <PantallaStock />,
    listo: () => boton('Editar Fideos'),
    hojas: [{ nombre: 'editar producto', abrir: () => abrirY('Editar Fideos') }],
  },
  {
    nombre: 'Plata',
    pantalla: () => <PantallaPlata />,
    listo: () => boton('Cerrar caja'),
    hojas: [{ nombre: 'cierre de caja', abrir: () => abrirY('Cerrar caja') }],
  },
  {
    nombre: 'Pedidos',
    pantalla: () => <PantallaPedidos />,
    listo: () => boton(/Nuevo pedido/),
    hojas: [{ nombre: 'nuevo pedido', abrir: () => abrirY(/Nuevo pedido/) }],
  },
  {
    nombre: 'Clientes',
    pantalla: () => <PantallaClientes />,
    listo: () => screen.findAllByText('Raúl'),
    hojas: [{ nombre: 'nuevo cliente', abrir: () => abrirY(/Nuevo cliente/) }],
  },
  { nombre: 'Historial', pantalla: () => <PantallaHistorial />, listo: () => screen.findByText(/\$4\.200/) },
  { nombre: 'Ajustes', pantalla: () => <PantallaConfig />, listo: () => boton('Guardar cambios') },
  { nombre: 'Cuenta', pantalla: () => <PantallaCuenta />, listo: () => screen.findByRole('link', { name: /volver a vender/i }) },
  { nombre: 'Control Pro', pantalla: () => <CentroPro />, listo: () => boton('Compartir resumen') },
  {
    nombre: 'Navegación',
    pantalla: () => <Navegacion />,
    listo: () => boton('Más'),
    hojas: [{ nombre: 'más secciones', abrir: () => abrirY('Más') }],
  },
]

describe.each([['vacía', false], ['con datos', true]])('axe, base %s', (_, conDatos) => {
  describe.each(CASOS)('$nombre', (caso) => {
    it('no tiene violaciones WCAG', async () => {
      if (conDatos) await cargarDatos()
      const { container } = render(caso.pantalla())
      if (conDatos) await caso.listo()
      else await new Promise((r) => setTimeout(r, 300))
      expect(await violacionesAxe(container)).toEqual([])
    })

    if (caso.nombre !== 'Navegación') {
      it('tiene un solo h1 y los títulos no se saltan niveles', async () => {
        if (conDatos) await cargarDatos()
        const { container } = render(caso.pantalla())
        if (conDatos) await caso.listo()
        else await new Promise((r) => setTimeout(r, 300))
        const titulos = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
        expect(titulos.filter((n) => n === 1), `h1 de ${caso.nombre}`).toHaveLength(1)
        expect(titulos[0]).toBe(1)
        titulos.forEach((nivel, i) => {
          if (i > 0) expect(nivel, `salto de h${titulos[i - 1]} a h${nivel}`).toBeLessThanOrEqual(titulos[i - 1] + 1)
        })
      })
    }

    if (conDatos && caso.hojas) {
      it('sus hojas abiertas no tienen violaciones WCAG', async () => {
        await cargarDatos()
        render(caso.pantalla())
        await caso.listo()
        for (const hoja of caso.hojas ?? []) {
          const dialogo = await hoja.abrir()
          // El resto de la página queda inerte: lo que se revisa es la hoja.
          expect(await violacionesAxe(dialogo), hoja.nombre).toEqual([])
        }
      })
    }
  })
})
