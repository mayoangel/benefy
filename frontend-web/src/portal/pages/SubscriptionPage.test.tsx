import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  refreshContext: vi.fn(),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    context: {
      es_admin_sistema: false,
      membresias: [{
        negocio: { id: 1, nombre: 'Café Aurora' },
        rol_comercio: 'dueno',
        status: true,
      }],
    },
    refreshContext: authState.refreshContext,
  }),
}));

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    codigo?: string;
    constructor(status: number, message: string, codigo?: string) {
      super(message);
      this.status = status;
      this.codigo = codigo;
    }
  },
  api: {
    getBilling: vi.fn(),
    createCheckout: vi.fn(),
    createBillingPortal: vi.fn(),
    syncBilling: vi.fn(),
  },
}));

import { api } from '../../lib/api';
import SubscriptionPage from './SubscriptionPage';

function facturacion(overrides: Record<string, unknown> = {}) {
  const base = {
    negocio: 1,
    plan: {
      id: 1,
      codigo: 'free',
      nombre: 'Free',
      descripcion: 'Plan gratuito.',
      orden: 10,
      status: true,
    },
    suscripcion: null,
    limites: {},
    caracteristicas: {
      metricas_avanzadas: false,
      exportacion_reportes: false,
      personalizacion_avanzada: false,
      alianzas: true,
      alianzas_proponer: false,
    },
    caracteristicas_implementadas: ['alianzas'],
    excedentes: [],
    facturacion: {
      habilitada: true,
      modo: 'test',
      motivo: '',
      aviso: 'Pagos de demostración en Stripe Sandbox. No se realizan cargos reales.',
      webhook_configurado: true,
      precios: [
        { intervalo: 'mensual', monto: '399.00', divisa: 'MXN', disponible: true },
        { intervalo: 'anual', monto: '3990.00', divisa: 'MXN', disponible: true },
      ],
      puede_contratar: true,
      puede_administrar: false,
      cliente_stripe_configurado: false,
      suscripcion: null,
      pagos: [],
    },
  };
  return {
    ...base,
    ...overrides,
    facturacion: {
      ...base.facturacion,
      ...((overrides.facturacion as Record<string, unknown> | undefined) ?? {}),
    },
  };
}

function renderPage(onRedirect = vi.fn(), ruta = '/portal/negocio/1/suscripcion') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/portal/negocio/:negocioId/suscripcion"
          element={<SubscriptionPage onRedirect={onRedirect} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.refreshContext.mockResolvedValue(undefined);
});

test('un propietario Free puede contratar Premium desde el checkout', async () => {
  vi.mocked(api.getBilling).mockResolvedValue(facturacion() as never);
  vi.mocked(api.createCheckout).mockResolvedValue({
    url: 'https://checkout.stripe.com/test',
    session_id: 'cs_test_123',
    reutilizada: false,
    modo: 'test',
  });
  const redirect = vi.fn();
  renderPage(redirect);

  expect(await screen.findByText('Contratar Premium')).toBeTruthy();
  expect(screen.getByText(/Modo demostración · Stripe Sandbox/)).toBeTruthy();
  expect(screen.getByText(/No se realizan cargos reales/)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: /Anual/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Contratar Premium' }));

  await waitFor(() => expect(api.createCheckout).toHaveBeenCalledWith(1, 'anual'));
  expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.com/test');
});

test('un Premium con cancelación programada muestra el aviso y administra el portal', async () => {
  const suscripcion = {
    id: 5,
    status: 'activa',
    stripe_status: 'active',
    origen: 'stripe',
    en_cancelacion: true,
    gracia_fin: null,
    fecha_inicio: '2026-01-01T00:00:00Z',
    fecha_fin: null,
    periodo_actual_inicio: '2026-01-01T00:00:00Z',
    periodo_actual_fin: '2026-12-31T00:00:00Z',
    proxima_renovacion: null,
    cancelacion_programada: true,
    acceso_premium: true,
  };
  vi.mocked(api.getBilling).mockResolvedValue(facturacion({
    plan: {
      id: 2,
      codigo: 'premium',
      nombre: 'Premium',
      descripcion: 'Plan de pago.',
      orden: 20,
      status: true,
    },
    suscripcion: {
      id: 5,
      status: 'activa',
      stripe_status: 'active',
      origen: 'stripe',
      en_cancelacion: true,
      gracia_fin: null,
      fecha_inicio: '2026-01-01T00:00:00Z',
      fecha_fin: null,
      periodo_actual_inicio: '2026-01-01T00:00:00Z',
      periodo_actual_fin: '2026-12-31T00:00:00Z',
    },
    facturacion: {
      puede_contratar: false,
      puede_administrar: true,
      cliente_stripe_configurado: true,
      suscripcion,
    },
  }) as never);
  vi.mocked(api.createBillingPortal).mockResolvedValue({
    url: 'https://billing.stripe.com/test',
    modo: 'test',
  });
  const redirect = vi.fn();
  renderPage(redirect);

  expect((await screen.findAllByText(/Cancelación programada/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/Las alianzas existentes no se eliminan/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Contratar Premium' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Administrar suscripción' }));

  await waitFor(() => expect(api.createBillingPortal).toHaveBeenCalledWith(1));
  expect(redirect).toHaveBeenCalledWith('https://billing.stripe.com/test');
});

test('el retorno exitoso sincroniza con Stripe y no activa por la URL sola', async () => {
  vi.mocked(api.getBilling).mockResolvedValue(facturacion() as never);
  vi.mocked(api.syncBilling).mockResolvedValue(facturacion({
    plan: {
      id: 2,
      codigo: 'premium',
      nombre: 'Premium',
      descripcion: 'Plan de pago.',
      orden: 20,
      status: true,
    },
    suscripcion: {
      id: 7,
      status: 'activa',
      stripe_status: 'active',
      origen: 'stripe',
      en_cancelacion: false,
      gracia_fin: null,
      fecha_inicio: '2026-01-01T00:00:00Z',
      fecha_fin: null,
      periodo_actual_inicio: '2026-01-01T00:00:00Z',
      periodo_actual_fin: '2026-02-01T00:00:00Z',
    },
    facturacion: {
      puede_contratar: false,
      puede_administrar: true,
      cliente_stripe_configurado: true,
      suscripcion: {
        id: 7,
        status: 'activa',
        stripe_status: 'active',
        origen: 'stripe',
        en_cancelacion: false,
        gracia_fin: null,
        fecha_inicio: '2026-01-01T00:00:00Z',
        fecha_fin: null,
        periodo_actual_inicio: '2026-01-01T00:00:00Z',
        periodo_actual_fin: '2026-02-01T00:00:00Z',
        proxima_renovacion: '2026-02-01T00:00:00Z',
        cancelacion_programada: false,
        acceso_premium: true,
      },
    },
  }) as never);

  renderPage(vi.fn(), '/portal/negocio/1/suscripcion?checkout=success&session_id=cs_test_123');

  expect(await screen.findByText(/Pago de prueba confirmado/)).toBeTruthy();
  expect(api.syncBilling).toHaveBeenCalledWith(1, 'cs_test_123');
  expect(authState.refreshContext).toHaveBeenCalled();
  expect(await screen.findByText('Premium activo')).toBeTruthy();
});

test('si Stripe Sandbox no está configurado no muestra el botón de contratación', async () => {
  vi.mocked(api.getBilling).mockResolvedValue(facturacion({
    facturacion: {
      habilitada: false,
      modo: 'deshabilitado',
      motivo: 'Falta STRIPE_SECRET_KEY de Sandbox.',
      puede_contratar: false,
      puede_administrar: false,
      precios: [
        { intervalo: 'mensual', monto: '399.00', divisa: 'MXN', disponible: false },
        { intervalo: 'anual', monto: '3990.00', divisa: 'MXN', disponible: false },
      ],
    },
  }) as never);

  renderPage();

  expect(await screen.findByText(/Stripe Sandbox no está disponible/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Contratar Premium' })).toBeNull();
});
