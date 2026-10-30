import { test, expect } from '@playwright/test'

test('la venta a medias sobrevive a cambiar de pantalla y se pueden tener dos abiertas', async ({ page }) => {
  await page.goto('/stock')
  for (const [nombre, precio] of [['Yerba Playadito', '4200'], ['Pan francés', '900']]) {
    await page.getByRole('button', { name: /^cargar$/i }).click()
    await page.getByLabel('Nombre').fill(nombre)
    await page.getByLabel('Costo').fill('100')
    await page.getByLabel('Precio').fill(precio)
    await page.getByLabel('Stock inicial').fill('10')
    await page.getByRole('button', { name: /guardar producto/i }).click()
    await expect(page.getByText(nombre, { exact: true })).toBeVisible()
  }

  await page.goto('/vender')
  await page.getByRole('button', { name: /^Yerba Playadito/ }).click()
  await page.getByRole('button', { name: 'Nueva venta' }).click()
  await page.getByRole('button', { name: /^Pan francés/ }).click()
  await page.screenshot({ path: test.info().outputPath('dos-ventas.png') })

  // se va a otra pantalla y vuelve: las dos ventas siguen ahí
  await page.goto('/plata')
  await page.goto('/vender')
  const tira = page.getByRole('group', { name: 'Ventas abiertas' })
  await expect(tira.getByRole('button', { name: /Venta 1, \$4\.200/ })).toBeVisible()
  await expect(tira.getByRole('button', { name: /Venta 2, \$900/ })).toBeVisible()
  await tira.getByRole('button', { name: /Venta 1/ }).click()
  await expect(page.getByRole('button', { name: /Cobrar|ver la venta/i }).first()).toBeVisible()
})
