import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { RolComercio } from '../lib/types.ts';

const authState = vi.hoisted(() => ({
  role: 'dueno' as RolComercio,
  admin: false,
  multiBusiness: false,
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => {
    const first = {
      id: 1,
      nombre: 'Café Aurora',
      plan: { codigo: 'free', nombre: 'Free' },
    };
    const businesses = authState.multiBusiness
      ? [first, { id: 2, nombre: 'Sucursal Norte', plan: { codigo: 'free', nombre: 'Free' } }]
      : [first];
    const memberships = authState.admin ? [] : businesses.map((negocio, index) => ({
      id: index + 1,
      negocio,
      rol_comercio: authState.role,
      status: true,
      sucursal: null,
    }));
    return {
      context: {
        es_admin_sistema: authState.admin,
        membresias: memberships,
        negocios: businesses,
        sucursales: authState.admin
          ? []
          : [
            { id: 11, negocio: 1, nombre: 'Centro', status: true },
            { id: 12, negocio: 1, nombre: 'Norte', status: true },
          ],
      },
      profile: { correo: 'owner@example.invalid' },
      signOut: vi.fn(),
      session: { user: { id: 'user-1' } },
    };
  },
}));

import PortalLayout from './PortalLayout';

function renderLayout(entry = '/portal/negocio/1') {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/portal/negocio/:negocioId" element={<PortalLayout />}>
          <Route index element={<div>Inicio</div>} />
          <Route path="visitas" element={<div>Visitas</div>} />
          <Route path="canjes" element={<div>Canjes</div>} />
          <Route path="recompensas" element={<div>Recompensas</div>} />
          <Route path="suscripcion" element={<div>Suscripción</div>} />
          <Route path="alianzas" element={<div>Alianzas</div>} />
        </Route>
        <Route path="/portal/admin" element={<PortalLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.role = 'dueno';
  authState.admin = false;
  authState.multiBusiness = false;
});

afterEach(cleanup);

test('mobile drawer exposes state, closes with Escape and restores focus', () => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  render(<MemoryRouter><PortalLayout /></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: /^Abrir/ });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

test('owner ve las cinco áreas y expande Actividad sin perder el filtro de sucursal', async () => {
  const user = userEvent.setup();
  renderLayout('/portal/negocio/1?sucursal=11');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));

  expect(nav.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page');
  expect(nav.getByRole('link', { name: 'Alianzas' })).toBeTruthy();
  const actividad = nav.getByRole('button', { name: 'Actividad' });
  expect(nav.getByRole('button', { name: 'Fidelización' })).toBeTruthy();
  expect(nav.getByRole('button', { name: 'Administración' })).toBeTruthy();
  expect(actividad.getAttribute('aria-expanded')).toBe('false');

  await user.click(actividad);
  expect(actividad.getAttribute('aria-expanded')).toBe('true');
  expect(nav.getByRole('link', { name: 'Clientes' })).toBeTruthy();
  expect(nav.getByRole('link', { name: 'Cupones' })).toBeTruthy();
  const visitas = nav.getByRole('link', { name: 'Visitas' });
  expect(visitas.getAttribute('href')).toBe('/portal/negocio/1/visitas?sucursal=11');

  await user.click(visitas);
  expect(actividad.getAttribute('aria-expanded')).toBe('true');
  expect(nav.getByRole('link', { name: 'Visitas' }).getAttribute('aria-current')).toBe('page');
});

test('la ruta activa expande automáticamente su grupo y permite navegación por teclado', async () => {
  const user = userEvent.setup();
  renderLayout('/portal/negocio/1/recompensas');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));
  const fidelizacion = nav.getByRole('button', { name: 'Fidelización' });
  await waitFor(() => expect(fidelizacion.getAttribute('aria-expanded')).toBe('true'));
  expect(nav.getByRole('link', { name: 'Recompensas' }).getAttribute('aria-current')).toBe('page');

  await user.click(fidelizacion);
  expect(fidelizacion.getAttribute('aria-expanded')).toBe('false');
  fidelizacion.focus();
  await user.keyboard('{Enter}');
  expect(fidelizacion.getAttribute('aria-expanded')).toBe('true');
});

test('Administración agrupa Sucursales, Equipo, Suscripción y Configuración', async () => {
  const user = userEvent.setup();
  renderLayout('/portal/negocio/1/suscripcion');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));
  const administracion = nav.getByRole('button', { name: 'Administración' });
  await waitFor(() => expect(administracion.getAttribute('aria-expanded')).toBe('true'));
  expect(nav.getByRole('link', { name: 'Sucursales' })).toBeTruthy();
  expect(nav.getByRole('link', { name: 'Equipo' })).toBeTruthy();
  expect(nav.getByRole('link', { name: 'Suscripción' }).getAttribute('aria-current')).toBe('page');
  expect(nav.getByRole('link', { name: 'Configuración' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Gestionar sucursales' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Registrar mi negocio' })).toBeNull();

  await user.click(nav.getByRole('button', { name: 'Actividad' }));
  expect(nav.getByRole('button', { name: 'Administración' }).getAttribute('aria-expanded')).toBe('true');
});

test('supervisor solo ve Actividad y Equipo dentro de sus permisos', async () => {
  authState.role = 'supervisor';
  renderLayout('/portal/negocio/1');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));
  expect(nav.getByRole('link', { name: 'Inicio' })).toBeTruthy();
  expect(nav.queryByRole('button', { name: 'Fidelización' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Alianzas' })).toBeNull();

  fireEvent.click(nav.getByRole('button', { name: 'Actividad' }));
  expect(nav.getByRole('link', { name: 'Visitas' })).toBeTruthy();
  expect(nav.getByRole('link', { name: 'Canjes' })).toBeTruthy();
  expect(nav.queryByRole('link', { name: 'Clientes' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Cupones' })).toBeNull();

  fireEvent.click(nav.getByRole('button', { name: 'Administración' }));
  expect(nav.getByRole('link', { name: 'Equipo' })).toBeTruthy();
  expect(nav.queryByRole('link', { name: 'Sucursales' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Suscripción' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Configuración' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Registrar otro negocio' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Registrar mi negocio' })).toBeTruthy();
});

test('empleado solo ve Inicio, Visitas y Canjes', () => {
  authState.role = 'empleado';
  renderLayout('/portal/negocio/1');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));
  expect(nav.getByRole('link', { name: 'Inicio' })).toBeTruthy();
  fireEvent.click(nav.getByRole('button', { name: 'Actividad' }));
  expect(nav.getByRole('link', { name: 'Visitas' })).toBeTruthy();
  expect(nav.getByRole('link', { name: 'Canjes' })).toBeTruthy();
  expect(nav.queryByRole('link', { name: 'Clientes' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Cupones' })).toBeNull();
  expect(nav.queryByRole('button', { name: 'Administración' })).toBeNull();
  expect(nav.queryByRole('button', { name: 'Fidelización' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Alianzas' })).toBeNull();
});

test('admin global conserva navegación separada y no mezcla áreas comerciales', () => {
  authState.admin = true;
  renderLayout('/portal/admin');
  const nav = within(screen.getByRole('navigation', { name: 'Navegación del portal' }));
  expect(nav.getByRole('link', { name: 'Administración global' })).toBeTruthy();
  expect(nav.queryByRole('link', { name: 'Inicio' })).toBeNull();
  expect(nav.queryByRole('button', { name: 'Actividad' })).toBeNull();
  expect(nav.queryByRole('button', { name: 'Fidelización' })).toBeNull();
  expect(nav.queryByRole('link', { name: 'Alianzas' })).toBeNull();
  expect(nav.queryByRole('button', { name: 'Administración' })).toBeNull();
});

test('selector de negocio visible con varias membresías y filtro de sucursal preservado', () => {
  authState.multiBusiness = true;
  renderLayout('/portal/negocio/1?sucursal=11');
  expect(screen.getByLabelText('Negocio')).toBeTruthy();
  expect(screen.getByLabelText('Sucursal')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
  expect(screen.getByRole('link', { name: 'Visitas' }).getAttribute('href')).toBe('/portal/negocio/1/visitas?sucursal=11');
});

test('Benef AI se abre desde el dashboard del negocio y se puede cerrar', async () => {
  const user = userEvent.setup();
  renderLayout('/portal/negocio/1');
  const trigger = screen.getByRole('button', { name: 'Benef AI' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  await user.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const dialog = screen.getByRole('dialog', { name: 'Benef AI' });
  expect(within(dialog).getByText('Pregunta por tu negocio')).toBeTruthy();
  expect(within(dialog).getByLabelText('Mensaje para Benef AI')).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Cerrar Benef AI' }));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

test('admin global no ve el asistente de negocio', () => {
  authState.admin = true;
  renderLayout('/portal/admin');
  expect(screen.queryByRole('button', { name: 'Benef AI' })).toBeNull();
});
