import React from 'react';
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PlanPanel from './PlanPanel';
import type { PlanNegocio } from '../../lib/types';

const limite = (uso: number, maximo: number) => ({
  uso,
  limite: maximo,
  disponible: Math.max(0, maximo - uso),
  excedido: uso > maximo,
});

const plan: PlanNegocio = {
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
  limites: {
    sucursales: limite(1, 1),
    programas_puntos: limite(0, 1),
    tarjetas_sellos: limite(0, 2),
    recompensas: limite(0, 5),
    supervisores: limite(0, 1),
    empleados: limite(0, 3),
    alianzas_activas: limite(2, 1),
    alianzas_con_free: limite(2, 1),
    alianzas_con_premium: limite(0, 1),
  },
  caracteristicas: {
    metricas_avanzadas: false,
    exportacion_reportes: false,
    personalizacion_avanzada: false,
    alianzas: true,
    alianzas_proponer: false,
  },
  caracteristicas_implementadas: ['alianzas', 'alianzas_proponer'],
  excedentes: ['alianzas_activas', 'alianzas_con_free'],
};

test('shows alliance limits and excedents in the plan panel', () => {
  render(
    <MemoryRouter>
      <PlanPanel plan={plan} />
    </MemoryRouter>,
  );

  expect(screen.getByText('Alianzas activas (total)')).toBeTruthy();
  expect(screen.getAllByText('2 / 1')).toHaveLength(2);
  expect(screen.getAllByText('Excedente de 1')).toHaveLength(2);
  expect(screen.getByText('Alianzas con negocios del plan gratis')).toBeTruthy();
  expect(screen.getByText('Alianzas con negocios del plan premium')).toBeTruthy();
  expect(screen.getByText('Proponer alianzas')).toBeTruthy();
  expect(screen.getAllByText('Solo plan premium')).toHaveLength(1);
});
