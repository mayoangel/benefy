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
  await dialog.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(reward.getByText('Inactiva', { exact: true })).toBeVisible();
  expect(writes).toEqual([{ path: '/api/v1/recompensa/actualizar/201/', method: 'PATCH', payload: { status: false } }]);
  await reward.getByRole('button', { name: 'Activar', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(writes).toHaveLength(1);
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

test('mobile tables preserve column context while keyboard scrolling', async ({ page }) => {
  await installVisualFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portal/negocio/1/clientes');
  const table = page.getByRole('region', { name: 'Listado de clientes' });
  await table.focus();
  await page.keyboard.press('End');
  await table.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  const first = page.getByRole('cell', { name: 'Mariana García' });
  await expect(first).toBeVisible();
  expect(await first.evaluate(node => getComputedStyle(node).position)).toBe('sticky');
  const box = await first.boundingBox();
  const region = await table.boundingBox();
  expect(Math.abs(box!.x - region!.x)).toBeLessThan(3);
});

test('empty results and HTTP errors remain visible and retry recovers', async ({ page }) => {
  await installVisualFixture(page, { empty: true });
  await page.goto('/portal/negocio/1/clientes');
  await expect(page.getByText('No hay clientes con esos criterios.')).toBeVisible();
  await page.route('**/clientes/**', route => route.fulfill({ status: 500, json: { detail: 'Fallo de prueba controlado' } }));
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fallo de prueba controlado');
  await page.unroute('**/clientes/**');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('No hay clientes con esos criterios.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const role of ['empleado', 'supervisor']) {
  test(`navigation retains the existing ${role} permissions`, async ({ page }) => {
    await installVisualFixture(page, { role });
    await page.goto('/portal/negocio/1');
    const nav = page.getByRole('navigation', { name: 'Navegación del portal' });
    await expect(nav.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Fidelización' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Alianzas' })).toHaveCount(0);
    await nav.getByRole('button', { name: 'Actividad' }).click();
    await expect(nav.getByRole('link', { name: 'Visitas' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Canjes' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Clientes' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Cupones' })).toHaveCount(0);
    if (role === 'supervisor') {
      await nav.getByRole('button', { name: 'Administración' }).click();
      await expect(nav.getByRole('link', { name: 'Equipo' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Suscripción' })).toHaveCount(0);
    } else {
      await expect(nav.getByRole('button', { name: 'Administración' })).toHaveCount(0);
    }
    await page.goto('/portal/negocio/1/recompensas');
    await expect(page.getByRole('alert')).toContainText('Solo el propietario');
    await expect(page.getByRole('button', { name: 'Nueva recompensa' })).toHaveCount(0);
  });
}

test('Inicio muestra actividad y solicitudes pendientes con enlace a Recibidas', async ({ page }) => {
  await installVisualFixture(page);
  await page.goto('/portal/negocio/1');
  await expect(page.getByText('Actividad reciente')).toBeVisible();
  await expect(page.getByText(/una solicitud de alianza pendiente/i)).toBeVisible();
  await page.getByRole('link', { name: 'Revisar solicitudes' }).click();
  await expect(page).toHaveURL(/alianzas\?tab=recibidas/);
  await expect(page.getByRole('tab', { name: /Recibidas/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Panadería Norte' })).toBeVisible();
});

test('clientes, visitas, cupones y canjes conservan el filtro del cliente', async ({ page }) => {
  await installVisualFixture(page);
  await page.goto('/portal/negocio/1/clientes');
  const mariana = page.getByRole('row').filter({ hasText: 'Mariana García' });
  await mariana.getByRole('link', { name: '18' }).click();
  await expect(page).toHaveURL(/visitas\?cliente=mariana/);
  await expect(page.getByPlaceholder('correo@ejemplo.com')).toHaveValue('mariana@example.invalid');
  const visita = page.getByRole('row').filter({ hasText: 'mariana@example.invalid' });
  await visita.getByRole('link', { name: 'mariana@example.invalid' }).click();
  await expect(page).toHaveURL(/clientes\?buscar=mariana/);
  await expect(page.getByPlaceholder('Cliente o correo')).toHaveValue('mariana@example.invalid');

  await page.goto('/portal/negocio/1/clientes');
  await page.getByRole('row').filter({ hasText: 'Mariana García' }).getByRole('link', { name: '3' }).click();
  await expect(page).toHaveURL(/cupones\?cliente=mariana/);
  await page.getByRole('link', { name: 'Ver canjes' }).click();
  await expect(page).toHaveURL(/canjes$/);
  await page.getByRole('link', { name: 'Ver cupones' }).click();
  await expect(page).toHaveURL(/cupones$/);
});

test('fidelización y QR ofrecen accesos contextuales entre pantallas', async ({ page }) => {
  await installVisualFixture(page);
  await page.goto('/portal/negocio/1/puntos');
  await page.getByRole('link', { name: 'Ver recompensas' }).click();
  await expect(page).toHaveURL(/recompensas$/);
  await page.getByRole('link', { name: 'Programa de puntos' }).click();
  await expect(page).toHaveURL(/puntos$/);

  await page.goto('/portal/negocio/1/tarjetas');
  await expect(page.getByText(/se edita en esta misma pantalla/)).toBeVisible();
  await page.goto('/portal/negocio/1/recompensas');
  await page.locator('.portal-note').getByRole('link', { name: 'Tarjetas de sellos' }).click();
  await expect(page).toHaveURL(/tarjetas$/);

  await page.goto('/portal/negocio/1');
  await page.getByRole('link', { name: /Sucursales y QR/ }).click();
  await expect(page).toHaveURL(/sucursales$/);
  await page.goto('/portal/negocio/1');
  await page.getByRole('link', { name: /Configuración y QR/ }).click();
  await expect(page).toHaveURL(/configuracion$/);
});

test('stamp card confirmation preserves the dynamic and linked reward updates', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/tarjetas');
  const row = page.getByRole('row').filter({ hasText: 'Tu café de siempre' });
  await row.getByRole('button', { name: 'Desactivar' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Desactivar tarjeta?' });
  await expect(dialog).toContainText('Los ciclos en curso podrán completarse.');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  expect(writes).toHaveLength(0);
  await row.getByRole('button', { name: 'Desactivar' }).click();
  await dialog.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('status')).toHaveText('Tarjeta desactivada.');
  expect(writes).toEqual([
    { path: '/api/v1/dinamica/actualizar/102/', method: 'PATCH', payload: { status: false } },
    { path: '/api/v1/recompensa/actualizar/202/', method: 'PATCH', payload: { status: false } },
  ]);
});

test('team invitations retain branch and role and require confirmation to revoke', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/equipo');
  await page.getByRole('button', { name: 'Invitar persona' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeFocused();
  await page.getByLabel('Correo electrónico').fill('prueba@example.invalid');
  await page.getByRole('combobox', { name: 'Rol', exact: true }).selectOption('empleado');
  await page.locator('form').getByRole('combobox', { name: 'Sucursal', exact: true }).selectOption('11');
  await page.getByRole('button', { name: 'Crear invitación' }).click();
  await expect(page.getByRole('status')).toContainText('Invitación creada.');
  const invitation = page.getByRole('row').filter({ hasText: 'lucia@example.invalid' });
  await invitation.getByRole('button', { name: 'Revocar', exact: true }).click();
  await page.getByRole('dialog', { name: '¿Revocar invitación?' }).getByRole('button', { name: 'Revocar' }).click();
  await expect(invitation.getByText('revocada', { exact: true })).toBeVisible();
  expect(writes).toEqual([
    { path: '/api/v1/negocios/1/invitaciones/', method: 'POST', payload: { correo: 'prueba@example.invalid', rol_comercio: 'empleado', sucursal: 11, motivo: '' } },
    { path: '/api/v1/invitaciones/fixture-invite/revocar/', method: 'POST', payload: null },
  ]);
});

test('reward editor preserves discount validation and payload', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portal/negocio/1/recompensas');
  await page.getByRole('article', { name: '20% en tu siguiente visita' }).getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Porcentaje')).toHaveAttribute('required', '');
  await page.getByLabel('Porcentaje').fill('25');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Recompensa actualizada.');
  expect(writes).toEqual([{ path: '/api/v1/recompensa/actualizar/203/', method: 'PATCH', payload: {
    titulo: '20% en tu siguiente visita', descripcion: 'Un detalle para que vuelvas.', tipo: 'descuento', descuento: 25,
    costo_desbloqueo: 80, terminos_condiciones: 'No acumulable.', vigencia_dias: 15, cantidad_disponible: null, status: false, negocio: 1,
  } }]);
});

test('points editor retains conversion, expiry and business scope', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/puntos');
  await page.getByRole('row').filter({ hasText: 'Puntos Nómada' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Puntos por visita').fill('15');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('Los puntos ya otorgados no cambian.');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: '/api/v1/dinamica/actualizar/101/', method: 'PATCH', payload: {
    nombre: 'Puntos Nómada', descripcion: 'Premiamos cada visita.', tipo: 'puntos', regla_conversion: 15,
    dias_expiracion_puntos: 180, fecha_fin: null, status: true, negocio: 1,
  } });
});

test('branch creation retains contact fields and business scope', async ({ page }) => {
  const writes: any[] = [];
  await installVisualFixture(page, { onRequest: request => { if (request.method !== 'GET') writes.push(request); } });
  await page.goto('/portal/negocio/1/sucursales');
  await page.getByRole('button', { name: 'Nueva sucursal' }).click();
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused();
  await page.getByLabel('Nombre', { exact: true }).fill('Sucursal de prueba');
  await page.getByLabel('Ciudad', { exact: true }).fill('Tijuana');
  await page.getByLabel('Dirección', { exact: true }).fill('Calle de prueba 123');
  await page.getByLabel('Teléfono').fill('6640000000');
  await page.getByLabel('Código postal').fill('22000');
  await page.getByRole('button', { name: 'Crear sucursal', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Sucursal creada.');
  expect(writes).toEqual([{ path: '/api/v1/sucursal/crear/', method: 'POST', payload: {
    nombre: 'Sucursal de prueba', ciudad: 'Tijuana', direccion: 'Calle de prueba 123', telefono: '6640000000', codigo_postal: '22000', status: true, negocio: 1,
  } }]);
});
