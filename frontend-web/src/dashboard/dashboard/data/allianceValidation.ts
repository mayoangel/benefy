import { isISODate } from './period';
import { merchants, ownMerchantId } from './demoData';
export type AllianceDraft = { merchantId: string; condition: string; benefit: string; start: string; end: string };
export function validateAlliance(draft: AllianceDraft, step: number) {
  const errors: Record<string, string> = {};
  if (step === 0 && (!merchants.some(m => m.id === Number(draft.merchantId)) || Number(draft.merchantId) === ownMerchantId)) errors.merchantId = 'Elige otro comercio; no puedes crear una alianza contigo mismo.';
  if (step === 1) {
    if (!draft.condition.trim()) errors.condition = 'Describe la condición de participación.';
    if (!draft.benefit.trim()) errors.benefit = 'Describe el beneficio.';
    if (!isISODate(draft.start)) errors.start = 'Selecciona la fecha inicial.';
    if (!isISODate(draft.end)) errors.end = 'Selecciona la fecha final.';
    else if (draft.start && draft.end <= draft.start) errors.end = 'La fecha final debe ser posterior a la inicial.';
  }
  return errors;
}
