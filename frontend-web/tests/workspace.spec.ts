import { test, expect } from '@playwright/test';
import { installVisualFixture } from './visual-fixture.mjs';

test('reward confirmation supports Escape, returns focus and submits the original payload only after confirmation', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/recompensas');
  const reward = page.getByRole('article', { name: 'Café de la casa' });
  await expect(reward.getByText('120', { exact: true })).toBeVisible();
  const deactivate = reward.getByRole('button', { name: 'Desactivar' });
  await deactivate.click();
  const dialog = page.getByRole('dialog', { name: '¿Desactivar recompensa?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(deactivate).toBeFocused();
  expect(writes).toEqual([]);
  await deactivate.click();
  await dialog.screenshot({ path: 'artifacts/portal-visual/after/dialog-recompensa.png' });
  await dialog.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(reward.getByText('Inactiva', { exact: true })).toBeVisible();
  expect(writes).toEqual([{ path: '/api/v1/recompensa/actualizar/201/', method: 'PATCH', payload: { status: false } }]);
});

test('business settings retain every field and send the existing contract', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/configuracion');
  await page.getByLabel('Nombre comercial').fill('Café Nómada Centro');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('Los datos del negocio se guardaron.');
  expect(writes).toEqual([{ path: '/api/v1/negocio/actualizar/1/', method: 'PATCH', payload: {
    nombre: 'Café Nómada Centro', descripcion: 'Café de especialidad y pan recién hecho en el corazón de Tijuana.',
    direccion: 'Av. Revolución 1200, Zona Centro', telefono: '6641234567', correo: 'hola@nomada.example.invalid',
    logo_url: '', banner_url: '', zona_horaria: 'America/Tijuana', categoria: 1,
  } }]);
});
