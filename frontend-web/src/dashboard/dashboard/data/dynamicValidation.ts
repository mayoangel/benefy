import { isISODate } from './period';
export type DynamicDraft = { name: string; type: 'puntos' | 'sellos' | 'cupones'; goal: string; conversion: string; reward: string; start: string; end: string };
export function validateDynamic(draft: DynamicDraft, step: number) {
  const errors: Record<string, string> = {};
  if (step === 0 && !['puntos', 'sellos', 'cupones'].includes(draft.type)) errors.type = 'Selecciona un tipo.';
  if (step === 1) {
    if (!draft.name.trim()) errors.name = 'Escribe el nombre de la dinámica.';
    const goal = Number(draft.goal);
    if (!Number.isFinite(goal) || goal <= 0) errors.goal = 'La cantidad debe ser mayor que cero.';
    else if (draft.type === 'sellos' && !Number.isInteger(goal)) errors.goal = 'La meta de sellos debe ser un número entero.';
    else if (draft.type === 'cupones' && goal > 100) errors.goal = 'El descuento no puede superar el 100 %.';
    if (draft.type === 'puntos' && (!Number.isFinite(Number(draft.conversion)) || Number(draft.conversion) <= 0)) errors.conversion = 'La conversión debe ser mayor que cero.';
  }
  if (step === 2) {
    if (!draft.reward.trim()) errors.reward = 'Describe la recompensa.';
    if (!isISODate(draft.start)) errors.start = 'Selecciona la fecha inicial.';
    if (!isISODate(draft.end)) errors.end = 'Selecciona la fecha final.';
    else if (draft.start && draft.end <= draft.start) errors.end = 'La fecha final debe ser posterior a la inicial.';
  }
  return errors;
}
