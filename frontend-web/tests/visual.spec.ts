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

test('admin retains global tables and distinct table names', async ({ page }) => {
  await installVisualFixture(page, { role: 'admin' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/portal/admin');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('table', { name: 'Listado de negocios' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Listado de usuarios' })).toBeVisible();
});
