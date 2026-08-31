import { test, expect } from '@playwright/test'

test('cargar un producto, venderlo y ver la ganancia', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Yerba Playadito')
  await page.getByLabel('Costo').fill('3000')
  await page.getByLabel('Precio').fill('4200')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Yerba Playadito', { exact: true })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Yerba Playadito' }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('5000')
  await expect(page.getByText('$800')).toBeVisible()
  await page.getByRole('button', { name: /cobrar \$4\.200/i }).click()
  // el ticket vacío es la señal de que la venta ya se guardó
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeDisabled()

  await page.goto('/plata')
  await expect(page.getByText('$4.200').first()).toBeVisible()
  await expect(page.getByText('$1.200')).toBeVisible()
})

test('la venta funciona con el celular sin señal', async ({ page, context }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Fideos')
  await page.getByLabel('Costo').fill('800')
  await page.getByLabel('Precio').fill('1200')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Fideos', { exact: true })).toBeVisible()

  await page.goto('/')
  await context.setOffline(true)

  await page.getByRole('button', { name: 'Fideos' }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.200/i }).click()

  // la venta quedó anotada aunque no haya red
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeDisabled()
  await expect(page.getByText('$1.200').first()).toBeVisible()
  await context.setOffline(false)
})

test('cerrar la caja cuadrada y que quede el registro', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Azúcar')
  await page.getByLabel('Costo').fill('1000')
  await page.getByLabel('Precio').fill('1400')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Azúcar', { exact: true })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Azúcar' }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.400/i }).click()
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeDisabled()

  await page.goto('/plata')
  await page.getByRole('button', { name: /^cerrar caja$/i }).click()
  await page.getByLabel(/contado en el cajón/i).fill('1400')
  await expect(page.getByText(/la caja cuadra/i)).toBeVisible()
  await page.getByRole('button', { name: /guardar cierre/i }).click()
  await expect(page.getByRole('button', { name: /^cerrar caja$/i })).toBeVisible()
  await expect(page.getByText(/últimos cierres/i)).toBeVisible()
})
