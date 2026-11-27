import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  memberships: [] as Array<{
    negocio: { id: number; nombre: string; status: boolean };
    rol_comercio: string;
    status: boolean;
  }>,
}));

vi.mock('../auth/AuthProvider.tsx', () => ({
  useAuth: () => ({
    createBusiness: vi.fn(),
    needsProfile: false,
    context: {
      membresias: authState.memberships,
      negocios: [],
      es_admin_sistema: false,
    },
  }),
}));

vi.mock('../lib/api.ts', () => ({
  api: {
    getCategories: vi.fn().mockResolvedValue([]),
  },
}));

import NewBusinessPage from './NewBusinessPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/registrar-negocio']}>
      <Routes>
        <Route path="/registrar-negocio" element={<NewBusinessPage />} />
        <Route path="/portal/negocio/:negocioId" element={<div>Portal del negocio</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  authState.memberships = [];
});

test('una cuenta propietaria no vuelve a ver el alta de negocio', async () => {
  authState.memberships = [{
    negocio: { id: 7, nombre: 'Café Aurora', status: true },
    rol_comercio: 'dueno',
    status: true,
  }];
  renderPage();
  expect(await screen.findByText('Portal del negocio')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Registra tu negocio' })).toBeNull();
});

test('una cuenta sin negocio propio puede registrar uno', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Registra tu negocio' })).toBeTruthy();
});

test('una membresía laboral no impide registrar un negocio propio', () => {
  authState.memberships = [{
    negocio: { id: 3, nombre: 'Barbería Norte', status: true },
    rol_comercio: 'supervisor',
    status: true,
  }];
  renderPage();
  expect(screen.getByRole('heading', { name: 'Registra tu negocio' })).toBeTruthy();
});
