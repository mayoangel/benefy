import { expect, test, type Page } from '@playwright/test';

async function revealFullPage(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += Math.max(window.innerHeight * 0.7, 420)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
  });
}

async function validateLanding(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Premia cada visita');
  await expect(page.getByRole('heading', { name: 'Herramientas pensadas para que tus clientes vuelvan.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plan gratis', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plan premium', exact: true })).toBeVisible();
  await expect(page.getByText('También disponible por $3,990 MXN al año.')).toBeVisible();
  await expect(page.locator('img[src*="points"]')).toHaveCount(3);
  await expect(page.locator('img[src*="coupons"]')).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
}

test('landing de escritorio representa el producto real sin overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await validateLanding(page);
  const featureReveal = page.locator('.landing-feature-grid');
  await expect.poll(() => featureReveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  await featureReveal.scrollIntoViewIfNeeded();
  await expect.poll(() => featureReveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await revealFullPage(page);
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
});

test('landing móvil conserva jerarquía, navegación y planes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await validateLanding(page);
  const featureReveal = page.locator('.landing-feature-grid');
  await expect.poll(() => featureReveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect.poll(() => featureReveal.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Cómo funciona' })).toBeVisible();
});

test('página de precios mantiene los límites reales', async ({ page }) => {
  await page.goto('/precios');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Empieza gratis');
  await expect(page.getByRole('table', { name: 'Límites de los planes gratis y premium' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Sucursales activas 1 5/ })).toBeVisible();
  await expect(page.getByText(/El plan premium se contrata desde la sección de Suscripción del/)).toBeVisible();

  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Producto' }).click();
  await expect(page).toHaveURL(/\/#producto$/);
  await expect(page.getByRole('heading', { name: 'Herramientas pensadas para que tus clientes vuelvan.' })).toBeInViewport();
});

test('About explica el producto real en escritorio y móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lealtad diseñada para funcionar');
  await expect(page.getByText('Una base de datos, dos experiencias')).toBeVisible();
  await expect(page.getByText('1,400 establecimientos')).toHaveCount(0);
  await expect(page.getByText(/compensación automática/i)).toHaveCount(0);
  await revealFullPage(page);
  await page.screenshot({ path: 'test-results/about-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await revealFullPage(page);
  await page.screenshot({ path: 'test-results/about-mobile.png', fullPage: true });
});

test('pantallas de acceso comparten el nuevo layout sin afectar formularios', async ({ browser, baseURL }) => {
  const routes = [
    ['/login', 'Iniciar sesión'],
    ['/registro', 'Crear cuenta en Benefy'],
    ['/recuperar', 'Recuperar contraseña'],
    ['/actualizar-password', 'Nueva contraseña'],
  ] as const;

  for (const [path, heading] of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => sessionStorage.setItem('benefy-test-signed-out', '1'));
    const routePage = await context.newPage();
    await routePage.goto(`${baseURL}${path}`);
    await expect(routePage.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(routePage.getByRole('complementary', { name: 'Capacidades del portal de Benefy' })).toBeVisible();
    const layout = await routePage.evaluate(() => {
      const header = document.querySelector('.auth-header')!.getBoundingClientRect();
      const main = document.querySelector('.auth-main')!.getBoundingClientRect();
      const card = document.querySelector('.auth-card')!.getBoundingClientRect();
      const footer = document.querySelector('.auth-footer')!.getBoundingClientRect();
      return {
        headerBottom: header.bottom,
        mainTop: main.top,
        cardTop: card.top,
        cardBottom: card.bottom,
        footerTop: footer.top,
        footerBottom: footer.bottom,
        viewport: window.innerHeight,
      };
    });
    expect(layout.cardTop).toBeGreaterThanOrEqual(layout.headerBottom - 1);
    expect(layout.mainTop).toBeGreaterThanOrEqual(layout.headerBottom - 1);
    expect(layout.footerTop).toBeGreaterThanOrEqual(layout.cardBottom - 1);
    if (layout.cardBottom < layout.viewport) {
      expect(layout.footerBottom).toBeGreaterThanOrEqual(layout.viewport - 1);
    }
    const overflow = await routePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (path === '/login') {
      await routePage.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
    }
    await context.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobileContext.addInitScript(() => sessionStorage.setItem('benefy-test-signed-out', '1'));
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${baseURL}/login`);
  await expect(mobilePage.getByRole('heading', { level: 1 })).toHaveText('Iniciar sesión');
  await expect(mobilePage.getByRole('complementary', { name: 'Capacidades del portal de Benefy' })).toBeHidden();
  await mobilePage.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await mobileContext.close();
});
