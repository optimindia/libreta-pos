import { test, expect } from '@playwright/test'

test('cargar un producto, venderlo y ver la ganancia', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Yerba Playadito')
  await page.getByLabel('Costo').fill('3000')
  await page.getByLabel('Precio').fill('4200')
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Yerba Playadito', { exact: true })).toBeVisible()

  await page.goto('/vender')
  await page.getByRole('button', { name: /^Yerba Playadito/ }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('5000')
  await expect(page.getByText('$800')).toBeVisible()
  await page.getByRole('button', { name: /cobrar \$4\.200/i }).click()
  // el ticket vacío es la señal de que la venta ya se guardó
  // con el ticket vacío la barra de cobro desaparece
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toHaveCount(0)

  await page.goto('/plata')
  await expect(page.getByText('$4.200').first()).toBeVisible()
  await expect(page.getByText('$1.200').first()).toBeVisible()
})

test('la venta funciona con el celular sin señal', async ({ page, context }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Fideos')
  await page.getByLabel('Costo').fill('800')
  await page.getByLabel('Precio').fill('1200')
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Fideos', { exact: true })).toBeVisible()

  await page.goto('/vender')
  await context.setOffline(true)

  await page.getByRole('button', { name: /^Fideos/ }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.200/i }).click()

  // la venta quedó anotada aunque no haya red
  // con el ticket vacío la barra de cobro desaparece
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toHaveCount(0)
  await expect(page.getByText('$1.200').first()).toBeVisible()
  await context.setOffline(false)
})

test('un lector físico agrega el producto al enviar código y Enter', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Lector USB')
  await page.getByLabel('Código de barras').fill('779001')
  await page.getByLabel('Costo').fill('500')
  await page.getByLabel('Precio').fill('900')
  await page.getByLabel('Stock inicial').fill('3')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Lector USB', { exact: true })).toBeVisible()

  await page.goto('/vender')
  await expect(page.getByRole('button', { name: /^Lector USB/ })).toBeVisible()
  await page.keyboard.type('779001', { delay: 8 })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeEnabled()
})

test('cerrar la caja cuadrada y que quede el registro', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Azúcar')
  await page.getByLabel('Costo').fill('1000')
  await page.getByLabel('Precio').fill('1400')
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Azúcar', { exact: true })).toBeVisible()

  await page.goto('/vender')
  await page.getByRole('button', { name: /^Azúcar/ }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.400/i }).click()
  // con el ticket vacío la barra de cobro desaparece
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toHaveCount(0)

  await page.goto('/plata')
  await page.getByRole('button', { name: /^cerrar caja$/i }).click()
  await page.getByLabel(/contado en el cajón/i).fill('1400')
  await expect(page.getByText(/la caja cuadra/i)).toBeVisible()
  await page.getByRole('button', { name: /guardar cierre/i }).click()
  await expect(page.getByRole('button', { name: /^cerrar caja$/i })).toBeVisible()
  await expect(page.getByText(/últimos cierres/i)).toBeVisible()
})

test('tras cobrar se puede mandar el ticket por WhatsApp', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Gaseosa')
  await page.getByLabel('Costo').fill('1000')
  await page.getByLabel('Precio').fill('1500')
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Gaseosa', { exact: true })).toBeVisible()

  await page.goto('/vender')
  await page.getByRole('button', { name: /^Gaseosa/ }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.500/i }).click()

  const cobrado = page.getByText('Cobrado')
  await expect(cobrado).toBeVisible()

  const link = page.getByRole('link', { name: /mandar el ticket por whatsapp/i })
  const href = await link.getAttribute('href')
  expect(href).toBeTruthy()
  expect(href!).toMatch(/^https:\/\/wa\.me\/\?text=/)
  expect(decodeURIComponent(href!)).toContain('*Total: $1.500*')

  await page.getByRole('button', { name: /nueva venta/i }).click()
  // con el ticket vacío la barra de cobro desaparece
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toHaveCount(0)
})
