// Navegador real, sin mocks, capturas ni credenciales en archivos versionados.
import { chromium, expect } from '@playwright/test';
const passwords = JSON.parse(process.env.BENEFY_SHOWCASE_PASSWORDS || '{}');
const baseUrl = process.env.BENEFY_SHOWCASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
);
const results = {};
let step = 'start';
try {
  for (const name of ['admin', 'business', 'user', 'supervisor', 'employee']) {
    step = name + ':login';
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-user').fill(name + '@benefy.com');
    await page.locator('#login-pass').fill(passwords[name]);
    await page.locator('#btn-primary-login').click();
    await page.waitForURL(url => url.pathname !== '/login', { timeout: 25000 });
    step = name + ':permissions';
    if (name === 'admin') {
      await expect(page).toHaveURL(/\/portal\/admin/);
      await expect(page.getByRole('table', { name: 'Listado de negocios' })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: 'Café Aurora' })).toHaveCount(1);
    } else if (name === 'user') {
      await expect(page).toHaveURL(/acceso-restringido/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu cuenta no tiene un negocio asociado');
    } else {
      await expect(page).toHaveURL(/\/portal\/negocio\/\d+/);
      await expect(page.locator('.portal-kpi strong').first()).toBeVisible();
      const navigation = page.getByRole('navigation', { name: 'Navegación del portal' });
      await expect(navigation.getByRole('link')).toHaveCount(name === 'business' ? 11 : name === 'supervisor' ? 4 : 3);
      if (name === 'business') {
        const selector = page.locator('.portal-selector select').first();
        const options = await selector.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent })));
        if (options.length !== 4) throw Error('Cantidad de negocios incorrecta');
        for (const option of options) {
          await selector.selectOption(option.value);
          await expect(page.locator('h1')).toHaveText(option.text);
          await expect(page.locator('.portal-kpi strong').first()).toBeVisible();
        }
        await navigation.getByRole('link', { name: 'Recompensas', exact: true }).click();
        await expect(page.locator('.portal-reward')).toHaveCount(2);
      }
    }
    step = name + ':logout';
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    step = name + ':logout-storage';
    // El handler de click es asíncrono: esperar a que el SDK termine el logout.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => /^sb-.*-auth-token$/.test(key))), { timeout: 20000 }).toEqual([]);
    await page.waitForURL(url => !url.pathname.startsWith('/portal') && url.pathname !== '/acceso-restringido', { timeout: 15000 });
    step = name + ':signed-out-guard';
    await page.goto(`${baseUrl}/portal`);
    await expect(page).toHaveURL(/\/login/);
    results[name] = { login: true, permissions: true, logout: true };
    await context.close();
  }
  console.log(JSON.stringify({
    browser: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    actual_http: true,
    screenshots: false,
    results,
  }));
} catch {
  console.error(JSON.stringify({ failed_step: step, sensitive_details_omitted: true }));
  process.exitCode = 1;
} finally { await browser.close(); }
