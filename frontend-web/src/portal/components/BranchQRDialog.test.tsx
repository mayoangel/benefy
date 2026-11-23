import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import BranchQRDialog from './BranchQRDialog';

const branch = {
  id: 3,
  nombre: 'Sucursal Centro',
  negocio: 1,
  status: true,
  ciudad: 'Tijuana',
  direccion: 'Av. Principal 1',
  qr_uuid: '3f2c1e9a-8b7d-4c6a-9e5f-1a2b3c4d5e6f',
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
});

afterEach(cleanup);

test('renders a real QR with the branch UUID and printable actions', () => {
  render(
    <BranchQRDialog
      branch={branch}
      businessName="Café Aurora"
      onClose={() => undefined}
    />,
  );

  expect(screen.getByRole('heading', { name: 'QR de Sucursal Centro' })).toBeTruthy();
  expect(screen.getByText(branch.qr_uuid)).toBeTruthy();
  expect(screen.getByTitle('QR para registrar visitas en Sucursal Centro')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Descargar SVG' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Imprimir QR' })).toBeTruthy();
});
