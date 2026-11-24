import type {
  Cupon,
  HistorialResultado,
  RecompensaCatalogo,
  SaldoPuntos,
  Tarjeta,
} from './api';
import {
  cuponDisponible,
  estadoCupon,
  estadoRecompensa,
  historialItems,
  negociosBilletera,
} from './loyalty';

const ahora = Date.parse('2026-06-01T12:00:00Z');

function cupon(overrides: Partial<Cupon> = {}): Cupon {
  return {
    uuid: '8f0f8c4d-0000-4000-8000-000000000000',
    recompensa: 1,
    negocio: 1,
    negocio_nombre: 'Café',
    negocio_slug: 'cafe',
    negocio_logo_url: null,
    origen: 'puntos',
    status: 'disponible',
    titulo_beneficio: 'Latte',
    descripcion_beneficio: 'Latte gratis',
    tipo_beneficio: 'gratis',
    descuento_beneficio: null,
    condiciones_beneficio: 'Válido hoy',
    costo_pagado: 10,
    fecha_emision: '2026-05-01T12:00:00Z',
    fecha_expiracion: '2026-06-30T12:00:00Z',
    ...overrides,
  };
}

function recompensa(overrides: Partial<RecompensaCatalogo> = {}): RecompensaCatalogo {
  return {
    id: 1,
    titulo: 'Latte',
    descripcion: 'Latte gratis',
    tipo: 'gratis',
    descuento: null,
    costo_desbloqueo: 100,
    terminos_condiciones: 'Válido hoy',
    fecha_expiracion: null,
    vigencia_dias: 30,
    cantidad_disponible: 5,
    negocio: 1,
    alianza: null,
    negocio_nombre: 'Café',
    negocio_logo_url: null,
    es_alianza: false,
    ...overrides,
  };
}

function saldo(negocio: number, nombre: string, puntos: number): SaldoPuntos {
  return {
    negocio,
    negocio_nombre: nombre,
    negocio_slug: nombre.toLowerCase(),
    negocio_logo_url: null,
    saldo_actual: puntos,
    fecha_actualizacion: '2026-05-01T12:00:00Z',
  };
}

function tarjeta(negocio: number, nombre: string, sellos: number, meta: number): Tarjeta {
  return {
    id: negocio * 10,
    dinamica: negocio,
    negocio,
    negocio_nombre: nombre,
    negocio_slug: nombre.toLowerCase(),
    negocio_logo_url: null,
    numero_ciclo: 1,
    sellos_actuales: sellos,
    meta,
    estado: 'en_curso',
    recompensa_titulo: 'Premio',
    recompensa_descripcion: '',
    recompensa_condiciones: '',
    fecha_inicio: '2026-05-01T12:00:00Z',
    fecha_fin: null,
    cupon: null,
  };
}

describe('estadoRecompensa', () => {
  it('detecta vencidas y agotadas antes que el saldo', () => {
    expect(estadoRecompensa(recompensa({ fecha_expiracion: '2026-05-01T12:00:00Z' }), 0, ahora))
      .toBe('Vencida');
    expect(estadoRecompensa(recompensa({ cantidad_disponible: 0 }), 0, ahora)).toBe('Agotada');
  });

  it('indica cuántos puntos faltan y cuándo está disponible', () => {
    expect(estadoRecompensa(recompensa({ costo_desbloqueo: 100 }), 40, ahora))
      .toBe('Te faltan 60 puntos');
    expect(estadoRecompensa(recompensa({ costo_desbloqueo: 100 }), 100, ahora))
      .toBe('Disponible');
  });
});

describe('estadoCupon', () => {
  it('distingue disponible, vencido, canjeado y anulado', () => {
    expect(estadoCupon(cupon(), ahora)).toBe('Disponible');
    expect(estadoCupon(cupon({ fecha_expiracion: '2026-05-01T12:00:00Z' }), ahora))
      .toBe('Vencido');
    expect(estadoCupon(cupon({ status: 'canjeado' }), ahora)).toBe('Canjeado');
    expect(estadoCupon(cupon({ status: 'anulado' }), ahora)).toBe('Anulado');
    expect(cuponDisponible(cupon(), ahora)).toBe(true);
  });

  it('trata una fecha inválida como no vencida para no ocultar cupones válidos', () => {
    expect(estadoCupon(cupon({ fecha_expiracion: 'sin-fecha' }), ahora)).toBe('Disponible');
  });
});

describe('negociosBilletera', () => {
  it('combina saldos y tarjetas sin duplicar comercios', () => {
    const resultado = negociosBilletera(
      [saldo(2, 'Zeta', 30), saldo(1, 'Alfa', 10)],
      [tarjeta(2, 'Zeta', 3, 5)],
    );
    expect(resultado.map(item => item.nombre)).toEqual(['Alfa', 'Zeta']);
    expect(resultado[1]).toMatchObject({ puntos: 30, tarjeta: { sellos_actuales: 3, meta: 5 } });
    expect(resultado[0].tarjeta).toBeUndefined();
  });
});

describe('historialItems', () => {
  it('combina visitas, movimientos y canjes en orden descendente', () => {
    const data: HistorialResultado = {
      visitas: [{
        id: 1,
        usuario: 1,
        negocio: 1,
        negocio_nombre: 'Café',
        negocio_slug: 'cafe',
        negocio_logo_url: null,
        sucursal: 2,
        sucursal_nombre: 'Centro',
        metodo_validacion: 'qr',
        tipo: 'visita',
        fecha: '2026-05-03T12:00:00Z',
        fecha_negocio: '2026-05-03',
        es_valida: true,
      }],
      movimientos: [{
        id: 2,
        negocio: 1,
        negocio_nombre: 'Café',
        negocio_slug: 'cafe',
        negocio_logo_url: null,
        lote: null,
        cupon: null,
        tipo: 'otorgado',
        cantidad: 10,
        referencia: null,
        descripcion: 'Visita',
        fecha: '2026-05-04T12:00:00Z',
      }],
      canjes: [{
        id: 3,
        cupon: 'uuid',
        negocio: 1,
        negocio_nombre: 'Café',
        negocio_slug: 'cafe',
        negocio_logo_url: null,
        sucursal: null,
        sucursal_nombre: null,
        fecha: '2026-05-02T12:00:00Z',
        origen: 'manual',
        anulado: false,
      }],
    };
    const items = historialItems(data);
    expect(items.map(item => item.id)).toEqual(['m-2', 'v-1', 'c-3']);
    expect(items[0]).toMatchObject({ kind: 'Puntos ganados', detail: '+10 puntos · Visita' });
    expect(items[1]).toMatchObject({ kind: 'Visita registrada', detail: 'Centro' });
  });
});
