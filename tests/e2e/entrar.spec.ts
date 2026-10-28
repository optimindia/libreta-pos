import { test, expect } from '@playwright/test'

test('la puerta de entrada aparece en un aparato vacío y se puede empezar de cero', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('¿Ya usás Libreta en otro aparato?')).toBeVisible()

  await page.getByRole('button', { name: /empezar de cero/i }).click()

  // al empezar de cero se muestra el inicio normal, sin la puerta, con VENDER arriba de todo
  await expect(page.getByText('¿Ya usás Libreta en otro aparato?')).toBeHidden()
  await expect(page.getByRole('link', { name: /^vender/i }).first()).toBeVisible()
})