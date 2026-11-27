import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const auth = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const apiMock = vi.hoisted(() => ({
  askBenefAI: vi.fn(),
}));

vi.mock('../../auth/AuthProvider.tsx', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    signOut: auth.signOut,
  }),
}));

vi.mock('../../lib/api.ts', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    ApiError,
    api: { askBenefAI: apiMock.askBenefAI },
  };
});

import BenefAIChat from './BenefAIChat';
import { ApiError } from '../../lib/api.ts';

function renderChat(businessId = 1, open = true, branchId: number | null = null) {
  const triggerRef = { current: document.createElement('button') };
  document.body.appendChild(triggerRef.current);
  const onClose = vi.fn();
  const view = render(
    <BenefAIChat
      open={open}
      businessId={businessId}
      businessName="Café Aurora"
      branchId={branchId}
      branchName={branchId ? 'Centro' : null}
      onClose={onClose}
      triggerRef={triggerRef}
    />,
  );
  return { ...view, onClose, triggerRef };
}

function escribir(texto: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje para Benef AI' }), {
    target: { value: texto },
  });
}

beforeEach(() => {
  apiMock.askBenefAI.mockReset();
  auth.signOut.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

test('muestra estado vacío, negocio actual y preguntas sugeridas', () => {
  renderChat();
  expect(screen.getByRole('dialog', { name: 'Benef AI' })).toBeTruthy();
  expect(screen.getAllByText('Café Aurora')).toHaveLength(2);
  expect(screen.getByText('Pregunta por tu negocio')).toBeTruthy();
  expect(screen.getByRole('button', { name: /alianzas activas/ })).toBeTruthy();
  expect(screen.getByLabelText('Mensaje para Benef AI')).toBeTruthy();
});

test('envía con Enter y renderiza la respuesta y las tools usadas', async () => {
  apiMock.askBenefAI.mockResolvedValue({
    answer: 'Tuvimos 12 visitas válidas.',
    tools_used: ['visitas', 'metricas'],
  });
  renderChat();
  escribir('¿Cuántas visitas tuvimos?');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), {
    key: 'Enter',
    shiftKey: false,
  });

  await waitFor(() => expect(apiMock.askBenefAI).toHaveBeenCalledTimes(1));
  expect(apiMock.askBenefAI.mock.calls[0][0]).toBe(1);
  expect(apiMock.askBenefAI.mock.calls[0][1]).toBe('¿Cuántas visitas tuvimos?');
  expect(apiMock.askBenefAI.mock.calls[0][4]).toBeNull();
  expect(await screen.findByText('Tuvimos 12 visitas válidas.')).toBeTruthy();
  expect(screen.getByText('Consultó: visitas, métricas.')).toBeTruthy();
  expect(screen.getByText('¿Cuántas visitas tuvimos?')).toBeTruthy();
});

test('Shift+Enter no envía y conserva el texto para una nueva línea', async () => {
  renderChat();
  escribir('Hola');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), {
    key: 'Enter',
    shiftKey: true,
  });
  expect(apiMock.askBenefAI).not.toHaveBeenCalled();
});

test('prevención de solicitudes duplicadas mientras responde', async () => {
  let resolver: (value: { answer: string; tools_used: string[] }) => void = () => {};
  apiMock.askBenefAI.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
  renderChat();
  escribir('¿Cuántas visitas?');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });

  expect(apiMock.askBenefAI).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Benef AI está pensando…')).toBeTruthy();
  resolver({ answer: 'Listo.', tools_used: [] });
  expect(await screen.findByText('Listo.')).toBeTruthy();
});

test('muestra errores recuperables y no borra el mensaje del usuario', async () => {
  apiMock.askBenefAI.mockRejectedValue(new ApiError(429, 'Demasiadas solicitudes.'));
  renderChat();
  escribir('¿Cuántas visitas?');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Has alcanzado el límite de consultas a Benef AI. Intenta más tarde.')).toBeTruthy();
  expect(screen.getByText('¿Cuántas visitas?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Editar y reintentar' })).toBeTruthy();
});

test('401 cierra la sesión y no mezcla la respuesta', async () => {
  apiMock.askBenefAI.mockRejectedValue(new ApiError(401, 'Sesión vencida.'));
  renderChat();
  escribir('Hola');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
});

test('reiniciar conversación limpia mensajes y error', async () => {
  apiMock.askBenefAI.mockResolvedValue({ answer: 'Respuesta.', tools_used: [] });
  renderChat();
  escribir('Hola');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });
  expect(await screen.findByText('Respuesta.')).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: 'Reiniciar conversación' }));
  expect(screen.getByText('Pregunta por tu negocio')).toBeTruthy();
  expect(screen.queryByText('Respuesta.')).toBeNull();
});

test('cambio de negocio limpia el contexto y descarta respuestas tardías', async () => {
  let resolver: (value: { answer: string; tools_used: string[] }) => void = () => {};
  apiMock.askBenefAI.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
  const view = renderChat(1);
  escribir('¿Visitas del negocio uno?');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });
  expect(apiMock.askBenefAI).toHaveBeenCalledTimes(1);

  view.rerender(
    <BenefAIChat
      open
      businessId={2}
      businessName="Otro negocio"
      onClose={view.onClose}
      triggerRef={view.triggerRef}
    />,
  );
  expect(screen.getAllByText('Otro negocio')).toHaveLength(2);
  expect(screen.getByText('Pregunta por tu negocio')).toBeTruthy();

  resolver({ answer: 'Respuesta del negocio uno.', tools_used: [] });
  await waitFor(() => expect(screen.queryByText('Respuesta del negocio uno.')).toBeNull());
});

test('cierra con el botón y avisa al contenedor', async () => {
  const { onClose } = renderChat();
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar Benef AI' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('envía la sucursal seleccionada y reinicia al cambiarla', async () => {
  apiMock.askBenefAI.mockResolvedValue({ answer: 'Listo.', tools_used: [] });
  const view = renderChat(1, true, 11);
  escribir('¿Visitas de esta sucursal?');
  fireEvent.keyDown(screen.getByLabelText('Mensaje para Benef AI'), { key: 'Enter' });
  await waitFor(() => expect(apiMock.askBenefAI).toHaveBeenCalledTimes(1));
  expect(apiMock.askBenefAI.mock.calls[0][4]).toBe(11);
  expect(await screen.findByText('Listo.')).toBeTruthy();

  view.rerender(
    <BenefAIChat
      open
      businessId={1}
      businessName="Café Aurora"
      branchId={12}
      branchName="Río"
      onClose={view.onClose}
      triggerRef={view.triggerRef}
    />,
  );
  expect(screen.getByText('Pregunta por tu negocio')).toBeTruthy();
  expect(screen.queryByText('Listo.')).toBeNull();
});
