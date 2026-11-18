import type { Account } from './platformData';

const now = new Date().toISOString();
const month = `${now.slice(0, 7)}-01T00:00:00Z`;
const sample = (total: number) => [{ mes: month, total }];

export const previewAccount: Account = {
  id: 1, nombre: 'Cuenta de demostración', correo: 'admin@example.com', rol: 'admin_sistema', estado: 'Activo',
};

export const previewData = {
  inicio: {
    metricas: {
      comerciosActivos: 24, comerciosSuspendidos: 2, consumidores: 480, visitas: 1240,
      canjes: 186, suscripcionesActivas: 21, pagosPendientes: 3,
    },
    series: { comercios: sample(5), consumidores: sample(64), visitas: sample(1240), canjes: sample(186) },
    incidenciasAbiertas: 1,
  },
  comercios: [
    { id: 1, nombre: 'Café Aurora', categoria: 'Cafetería', estado: 'Activo', plan: 'Profesional',
      fecha: now, correo: 'aurora@example.com', direccion: 'Zona Centro',
      suscripcion: 'Activa', dinamicas: 3, alianzas: 1, visitas: 342, canjes: 56 },
    { id: 2, nombre: 'Mercado Olivo', categoria: 'Comercio', estado: 'Suspendido', plan: 'Básico',
      fecha: now, correo: 'olivo@example.com', direccion: 'Zona Centro',
      suscripcion: 'Pago pendiente', dinamicas: 1, alianzas: 0, visitas: 88, canjes: 12 },
  ],
  consumidores: [
    { id: 1, nombre: 'Lucía Torres', correo: 'lucia@example.com', estado: 'Activo', fecha: now, visitas: 12, canjes: 3 },
  ],
  suscripciones: [
    { id: 1, comercio: 'Café Aurora', plan: 'Profesional', estado: 'Activa', fecha: now,
      historial: [{ fecha: now, detalle: 'Suscripción activada.' }] },
    { id: 2, comercio: 'Mercado Olivo', plan: 'Básico', estado: 'Pago pendiente', fecha: now,
      historial: [{ fecha: now, detalle: 'El pago está pendiente.' }] },
  ],
  roles: [previewAccount, { id: 2, nombre: 'Dueño de ejemplo', correo: 'dueno@example.com', rol: 'negocio', estado: 'Activo' }],
  auditoria: [
    { id: 1, fecha: now, usuario: 'admin@example.com', rol: 'admin_sistema', operacion: 'Inicio de sesión',
      resultado: 'Confirmado' },
  ],
  incidencias: [
    { id: 1, fecha: now, tipo: 'Soporte', relacionado: 'Café Aurora', estado: 'abierta',
      descripcion: 'Consulta sobre la renovación del plan.', historial: [] },
  ],
  avisos: [{
    id: 1, inicio: new Date(Date.now() + 3 * 86400000).toISOString(),
    fin: new Date(Date.now() + 3 * 86400000 + 7200000).toISOString(),
    mensaje: 'Actualización programada de la plataforma.',
  }],
};
