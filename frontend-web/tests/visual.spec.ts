import { test, expect } from '@playwright/test';
import { installVisualFixture, routes } from './visual-fixture.mjs';

for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
  test(`populated portal: ${device}, all business sections`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await installVisualFixture(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const section of routes) {
      await page.goto('/portal/negocio/1/' + section);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveTitle((await page.locator('h1').innerText()) + ' | Benefy');
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(await page.locator('.portal-form input, .portal-form select, .portal-form textarea, .portal-filters input, .portal-filters select').evaluateAll(inputs => inputs.every(input => input.id && document.querySelector(`label[for="${input.id}"]`)))).toBe(true);
      const overflow = await page.locator('.portal-main, .portal-content, .portal-panel, .portal-page-head, .portal-form-grid').evaluateAll(nodes => nodes.some(node => {
        const box = node.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1;
      }));
      expect(overflow, section).toBe(false);
      for (const table of await page.getByRole('table').all()) await expect(table).toHaveAccessibleName(/Listado/);
    }
    expect(errors).toEqual([]);
  });
}

test('branch and business QR are generated from the real UUID and remain accessible', async ({ page }) => {
  await installVisualFixture(page);
  await page.goto('/portal/negocio/1/sucursales');
  const row = page.getByRole('row').filter({ hasText: 'Centro' });
  await row.getByRole('button', { name: 'Ver QR' }).click();
  const dialog = page.getByRole('dialog', { name: 'QR de Centro' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('3f2c1e9a-8b7d-4c6a-9e5f-1a2b3c4d5e6f')).toBeVisible();
  await expect(dialog.locator('svg')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Descargar SVG' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Imprimir QR' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.goto('/portal/negocio/1/configuracion');
  await page.getByRole('button', { name: 'Ver QR del negocio' }).click();
  const businessDialog = page.getByRole('dialog', { name: 'QR del negocio' });
  await expect(businessDialog).toBeVisible();
  await expect(businessDialog.getByText('9b8a7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d')).toBeVisible();
  await expect(businessDialog.getByText('Café Nómada · Negocio completo')).toBeVisible();
});

test('alliances page lets Free receive proposals while sending stays Premium', async ({ page }) => {
  await installVisualFixture(page);
  await page.goto('/portal/negocio/1/alianzas');
  await expect(page.getByRole('heading', { name: 'Alianzas comerciales' })).toBeVisible();
  await expect(page.getByText(/puedes recibir, aceptar y rechazar solicitudes/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proponer alianza' })).toBeDisabled();
  await page.getByRole('tab', { name: /Recibidas/ }).click();
  await expect(page.getByRole('heading', { name: 'Panadería Norte' })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar solicitud' }).click();
  const dialog = page.getByRole('dialog', { name: 'Panadería Norte' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Aceptar alianza' })).toBeEnabled();
});

test('admin retains global tables and distinct table names', async ({ page }) => {
  await installVisualFixture(page, { role: 'admin' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/portal/admin');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('table', { name: 'Listado de negocios' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Listado de usuarios' })).toBeVisible();
});
