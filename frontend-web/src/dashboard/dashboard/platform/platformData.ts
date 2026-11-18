import type { Period } from '../data/demoData';

export const roleLabels: Record<string, string> = {
  admin_sistema: 'Administrador general', negocio: 'Dueño del negocio', consumidor: 'Consumidor',
};

export const incidentLabels: Record<string, string> = {
  abierta: 'Abierta', seguimiento: 'En seguimiento', resuelta: 'Resuelta',
};

export interface HistoryEntry {
  fecha: string;
  detalle: string;
  usuario?: string;
}

export interface Row {
  id: number;
  historial?: HistoryEntry[];
  [field: string]: string | number | HistoryEntry[] | null | undefined;
}

export interface Account extends Row {
  nombre: string;
  correo: string;
  rol: string;
}

export const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short',
});

export const utc6 = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Etc/GMT+6',
});

export function periodQuery(period: Period) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - Number(period.kind) + 1);
  return period.kind === 'custom' ? new URLSearchParams({ inicio: period.start, fin: period.end }) :
    new URLSearchParams({ inicio: start.toISOString().slice(0, 10), fin: end.toISOString().slice(0, 10) });
}
