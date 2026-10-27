import { test, expect } from '@playwright/test'

test('el Centro Pro presenta sus 30 capacidades y atajos operativos', async ({ page }) => {
  await page.goto('/operacion')

  await expect(page.getByRole('heading', { name: 'Centro Pro' })).toBeVisible()
  await expect(page.getByText('30 nuevas funciones activas')).toBeVisible()
  await expect(page.getByText('Alertas priorizadas', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Nueva venta/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir stock completo/i })).toBeVisible()
})

test('una función apagada desaparece del menú y bloquea el acceso directo', async ({ page }) => {
  await page.goto('/config')
  const pedidos = page.getByRole('switch', { name: /Pedidos/ })
  await expect(pedidos).toBeVisible()
  if (await pedidos.getAttribute('aria-checked') === 'true') await pedidos.click()

  await page.goto('/pedidos')
  await expect(page.getByRole('heading', { name: 'Pedidos está oculta' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Configurar funciones/i })).toBeVisible()

  await page.goto('/config#funciones')
  const pedidosDeNuevo = page.getByRole('switch', { name: /Pedidos/ })
  if (await pedidosDeNuevo.getAttribute('aria-checked') === 'false') await pedidosDeNuevo.click()
  await page.goto('/pedidos')
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
})
