import React from 'react';
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const planState = vi.hoisted(() => ({ premium: true }));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    context: {
      membresias: [{
        negocio: { id: 1, nombre: 'Café Aurora' },
        rol_comercio: 'dueno',
        status: true,
      }],
    },
  }),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: {
      plan: { codigo: planState.premium ? 'premium' : 'free', nombre: planState.premium ? 'Premium' : 'Free' },
      caracteristicas: {
        alianzas: true,
        alianzas_proponer: planState.premium,
      },
      limites: {
        alianzas_activas: {
          uso: 0,
          limite: planState.premium ? 4 : 1,
          disponible: planState.premium ? 4 : 1,
          excedido: false,
        },
        alianzas_con_free: {
          uso: 0,
          limite: 1,
          disponible: 1,
          excedido: false,
        },
        alianzas_con_premium: {
          uso: 0,
          limite: planState.premium ? 3 : 1,
          disponible: planState.premium ? 3 : 1,
          excedido: false,
        },
      },
    },
    loading: false,
  }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    getAlliances: vi.fn(),
    discoverAlliances: vi.fn(),
    getAlliance: vi.fn(),
    createAllianceReward: vi.fn(),
    acceptAlliance: vi.fn(),
    rejectAlliance: vi.fn(),
    finalizeAlliance: vi.fn(),
  },
}));

import { api } from '../../lib/api';
import AlliancesPage from './AlliancesPage';

beforeEach(() => {
  planState.premium = true;
});

const negocio = {
  id: 2,
  nombre: 'Panadería Norte',
  descripcion: 'Pan artesanal',
  direccion: 'Centro',
  logo_url: null,
  categoria: 1,
  categoria_nombre: 'Panadería',
};

const alianza = {
  id: 10,
  negocio1: negocio,
  negocio2: {
    ...negocio,
    id: 1,
    nombre: 'Café Aurora',
  },
  condicion_participacion: 'Descuento cruzado para clientes.',
  status: 'pendiente' as const,
  vigente: false,
  fecha_inicio: '2026-12-01T00:00:00Z',
  fecha_fin: '2027-01-01T00:00:00Z',
  fecha_solicitud: '2026-11-23T00:00:00Z',
  fecha_respuesta: null,
  direccion: 'recibida' as const,
  numero_beneficios: 0,
};

test('received proposals are visible and actionable from the received tab', async () => {
  vi.mocked(api.getAlliances).mockResolvedValue([alianza]);
  vi.mocked(api.discoverAlliances).mockResolvedValue([negocio]);

  render(
    <MemoryRouter initialEntries={['/portal/negocio/1/alianzas']}>
      <Routes>
        <Route path="/portal/negocio/:negocioId/alianzas" element={<AlliancesPage />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: /Recibidas/ }));
  expect(await screen.findByText('Panadería Norte')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Revisar solicitud' })).toBeTruthy();
  cleanup();
});

test('free plan can receive proposals but cannot send them', async () => {
  planState.premium = false;
  vi.mocked(api.getAlliances).mockResolvedValue([]);
  vi.mocked(api.discoverAlliances).mockResolvedValue([negocio]);

  render(
    <MemoryRouter initialEntries={['/portal/negocio/1/alianzas']}>
      <Routes>
        <Route path="/portal/negocio/:negocioId/alianzas" element={<AlliancesPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText(/puedes recibir, aceptar y rechazar solicitudes/)).toBeTruthy();
  cleanup();
});
