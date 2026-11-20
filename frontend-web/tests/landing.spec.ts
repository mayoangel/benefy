import { expect, test, type Page } from '@playwright/test';

async function validateLanding(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Premia cada visita');
  await expect(page.getByRole('heading', { name: 'Funciones que ya forman parte de la operación.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  await expect(page.getByText('Precio orientativo. La activación actual es manual.')).toBeVisible();
  await expect(page.locator('img[src*="points"]')).toHaveCount(3);
  await expect(page.locator('img[src*="coupons"]')).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
}

test('landing de escritorio representa el producto real sin overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await validateLanding(page);
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
});

test('landing móvil conserva jerarquía, navegación y planes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await validateLanding(page);
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Cómo funciona' })).toBeVisible();
});

test('página de precios mantiene los límites reales', async ({ page }) => {
  await page.goto('/precios');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Empieza gratis');
  await expect(page.getByRole('table', { name: 'Límites actuales de los planes Free y Premium' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Sucursales activas 1 5/ })).toBeVisible();
  await expect(page.getByText('Premium requiere activación manual.')).toBeVisible();

  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Producto' }).click();
  await expect(page).toHaveURL(/\/#producto$/);
  await expect(page.getByRole('heading', { name: 'Funciones que ya forman parte de la operación.' })).toBeInViewport();
});
