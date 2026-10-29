import { test, expect, type Page } from '@playwright/test'
import {
  HORA, abrirYAsegurarOffline, cargarProducto, fijarVerificadoEn, leerCola, prepararNubeFalsa, type NubeFalsa,
} from './apoyo'

// Build de producción con la puerta SaaS real: sin sesión no se entra. La
// nube es falsa (ver apoyo.ts) y ninguna prueba toca internet.

const TEXTO_LOGIN = 'Ingresá a tu negocio'

let nube: NubeFalsa

test.beforeEach(async ({ context }) => {
  nube = await prepararNubeFalsa(context)
})

test.afterEach(() => {
  expect(nube.externas, 'ninguna petición debe salir a internet').toEqual([])
})

/** Una app abierta con señal, con un producto cargado y la cola ya subida. */
async function appListaConProducto(page: Page, nombre: string, precio: string): Promise<void> {
  await abrirYAsegurarOffline(page)
  await cargarProducto(page, nombre, '800', precio)
  // El alta del producto se sube sola: la cola queda vacía antes de cortar la señal.
  await expect.poll(async () => (await leerCola(page)).length).toBe(0)
}

async function venderSinSenal(page: Page, nombre: string, total: string): Promise<void> {
  await page.goto('/vender')
  nube.escrituras.length = 0
  await page.context().setOffline(true)
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('radio', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('5000')
  await page.getByRole('button', { name: new RegExp(`cobrar \\$${total}`, "i") }).click()
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toHaveCount(0)
}

test('vender sin señal deja la venta en la cola de sync', async ({ page }) => {
  await appListaConProducto(page, 'Fideos', '1200')
  await venderSinSenal(page, 'Fideos', '1\\.200')

  await expect.poll(async () => (await leerCola(page)).some((item) => item.entidad === 'venta')).toBe(true)
  const cola = await leerCola(page)
  const venta = cola.find((item) => item.entidad === 'venta')
  expect(venta, 'la venta tiene que estar en la cola').toBeTruthy()
  expect(venta).toMatchObject({ operacion: 'crear', intentos: 0 })
  // el descuento de stock viaja junto con la venta
  expect(cola.some((item) => item.entidad === 'movimientoStock')).toBe(true)
  // sin señal nada llegó a la nube
  expect(nube.escrituras).toEqual([])
})

test('al volver la señal la cola se vacía y la nube recibe la venta', async ({ page, context }) => {
  await appListaConProducto(page, 'Yerba', '4200')
  await venderSinSenal(page, 'Yerba', '4\\.200')
  await expect.poll(async () => (await leerCola(page)).some((item) => item.entidad === 'venta')).toBe(true)
  const idVenta = (await leerCola(page)).find((item) => item.entidad === 'venta')!.id.replace('venta:', '')

  await context.setOffline(false)

  await expect.poll(async () => (await leerCola(page)).length, { timeout: 20_000 }).toBe(0)
  const ventas = nube.escrituras.filter((escritura) => escritura.ruta === '/rest/v1/ventas')
  expect(JSON.stringify(ventas.map((v) => v.cuerpo))).toContain(idVenta)
  expect(nube.escrituras.some((e) => e.ruta === '/rest/v1/venta_items')).toBe(true)
  expect(nube.escrituras.some((e) => e.ruta === '/rest/v1/rpc/registrar_movimiento_stock')).toBe(true)
})

test('con la nube caída la venta se reintenta y no se pierde', async ({ page, context }) => {
  await appListaConProducto(page, 'Arroz', '1500')
  await venderSinSenal(page, 'Arroz', '1\\.500')
  await expect.poll(async () => (await leerCola(page)).some((item) => item.entidad === 'venta')).toBe(true)
  // Vuelve la señal del teléfono, pero la nube todavía no contesta.
  nube.caida = true
  await context.setOffline(false)

  await expect.poll(async () => (await leerCola(page)).find((item) => item.entidad === 'venta')?.intentos ?? 0, { timeout: 20_000 }).toBeGreaterThan(0)
  expect((await leerCola(page)).some((item) => item.entidad === 'venta')).toBe(true)

  // Cuando la nube contesta, la próxima vuelta la sube.
  nube.caida = false
  await page.evaluate(() => window.dispatchEvent(new Event('libreta:datos-pendientes')))
  await expect.poll(async () => (await leerCola(page)).length, { timeout: 20_000 }).toBe(0)
})

test('con la última confirmación de hace menos de 72 h y sin red no manda al login', async ({ page, context }) => {
  await abrirYAsegurarOffline(page)
  await fijarVerificadoEn(page, Date.now() - 71 * HORA)
  await context.setOffline(true)

  await page.goto('/vender')
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await expect(page.getByText(TEXTO_LOGIN)).toHaveCount(0)
  await expect(page.getByText('Conectate para continuar')).toHaveCount(0)
})

test('pasadas las 72 h sin verificar, sin red pide conectarse (y tampoco muestra el login)', async ({ page, context }) => {
  await abrirYAsegurarOffline(page)
  await fijarVerificadoEn(page, Date.now() - 73 * HORA)
  await context.setOffline(true)

  await page.goto('/vender')
  await expect(page.getByText('Conectate para continuar')).toBeVisible()
  await expect(page.getByText(TEXTO_LOGIN)).toHaveCount(0)
})

test('sin red, un token vencido no cierra la sesión del aparato', async ({ page, context }) => {
  await abrirYAsegurarOffline(page)
  // El token guardado vence (un día sin abrir la app) y sin señal no se puede renovar.
  await page.evaluate(() => {
    const clave = 'sb-falso-auth-token'
    const sesion = JSON.parse(localStorage.getItem(clave) ?? '{}')
    sesion.expires_at = Math.floor(Date.now() / 1000) - 3600
    localStorage.setItem(clave, JSON.stringify(sesion))
  })
  await context.setOffline(true)

  await page.goto('/vender')
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await expect(page.getByText(TEXTO_LOGIN)).toHaveCount(0)
  await expect(page.getByText('Conectate para continuar')).toHaveCount(0)
})

test('recargar sin red sigue abriendo la app (service worker)', async ({ page, context }) => {
  await abrirYAsegurarOffline(page)
  await context.setOffline(true)

  await page.reload()
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await expect(page.getByText(TEXTO_LOGIN)).toHaveCount(0)

  // y otra pantalla ya visitada también abre
  await context.setOffline(false)
  await page.goto('/vender')
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await expect(page.getByText(TEXTO_LOGIN)).toHaveCount(0)
})

test('tras la primera carga, una pantalla que nunca se abrió también abre sin red', async ({ page, context }) => {
  // Sin la recarga "de calentamiento": el service worker tiene que haber
  // guardado, además del HTML, los archivos de cada pantalla.
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await context.setOffline(true)

  await page.goto('/stock')
  await expect(page.getByRole('button', { name: /^cargar$/i })).toBeVisible()
  await page.goto('/vender')
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
  await expect(page.getByText('This page couldn’t load')).toHaveCount(0)
})
