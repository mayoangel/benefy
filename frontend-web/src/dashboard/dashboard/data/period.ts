import type { Period } from './demoData';
import { date } from './format';
export const periodDays = (period: Period) => period.kind === 'custom' ? Math.max(1, Math.round((new Date(period.end).getTime() - new Date(period.start).getTime()) / 86400000) + 1) : Number(period.kind);
export const periodScale = (period: Period) => periodDays(period) / 7;
export const periodLabel = (period: Period) => period.kind === 'custom' ? `${date(period.start)} → ${date(period.end)}` : period.kind === '1' ? 'Hoy' : `Últimos ${period.kind} días`;

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validatePeriod(start: string, end: string) {
  if (!isISODate(start) || !isISODate(end)) return 'Selecciona ambas fechas con valores válidos.';
  return start > end ? 'La fecha inicial no puede ser posterior a la final.' : '';
}
