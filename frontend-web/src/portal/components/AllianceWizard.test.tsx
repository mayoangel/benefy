import React from 'react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../lib/api', () => ({
  api: { createAlliance: vi.fn() },
}));

import { api } from '../../lib/api';
import AllianceWizard from './AllianceWizard';

const merchant = {
  id: 2,
  nombre: 'Panadería Norte',
  descripcion: 'Pan artesanal',
  direccion: 'Centro',
  logo_url: null,
  categoria: 1,
  categoria_nombre: 'Panadería',
};

const created = {
  id: 10,
  negocio1: { ...merchant, id: 1, nombre: 'Café Aurora' },
  negocio2: merchant,
  condicion_participacion: 'Beneficio cruzado.',
  status: 'pendiente' as const,
  vigente: false,
  fecha_inicio: '2026-12-01T00:00:00Z',
  fecha_fin: '2027-01-01T00:00:00Z',
  fecha_solicitud: '2026-11-23T00:00:00Z',
  fecha_respuesta: null,
  direccion: 'enviada' as const,
  numero_beneficios: 0,
  eventos: [],
  recompensas: [],
  creado_por_correo: 'aurora@example.invalid',
  respondido_por_correo: null,
  puede_responder: false,
  puede_finalizar: false,
  puede_agregar_beneficio: false,
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  vi.mocked(api.createAlliance).mockResolvedValue(created);
});

afterEach(cleanup);

test('wizard reviews and sends the proposal with business scoped dates', async () => {
  const onCreated = vi.fn();
  render(
    <AllianceWizard
      businessId={1}
      merchant={merchant}
      onClose={vi.fn()}
      onCreated={onCreated}
    />,
  );

  fireEvent.change(screen.getByLabelText('Condición de participación'), {
    target: { value: 'Beneficio cruzado.' },
  });
  fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-01' } });
  fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2027-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta' }));
  expect(screen.getByText('Beneficio cruzado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

  await waitFor(() => expect(api.createAlliance).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.createAlliance).mock.calls[0][0]).toMatchObject({
    negocio: 1,
    negocio_destino: 2,
    condicion_participacion: 'Beneficio cruzado.',
  });
  expect(vi.mocked(api.createAlliance).mock.calls[0][0].fecha_inicio)
    .toBe(new Date('2026-12-01T00:00:00').toISOString());
  expect(vi.mocked(api.createAlliance).mock.calls[0][0].fecha_fin)
    .toBe(new Date('2027-01-01T23:59:59').toISOString());
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
});
