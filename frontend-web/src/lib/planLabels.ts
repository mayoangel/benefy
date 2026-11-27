type PlanLike = {
  codigo?: string | null;
  nombre?: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Plan gratis',
  premium: 'Plan premium',
};

export function planLabel(plan?: PlanLike | string | null): string {
  if (!plan) return 'Plan';
  if (typeof plan === 'string') {
    const normalized = plan.trim().toLowerCase();
    return PLAN_LABELS[normalized] ?? plan;
  }
  const codigo = (plan.codigo ?? '').trim().toLowerCase();
  if (PLAN_LABELS[codigo]) return PLAN_LABELS[codigo];
  const nombre = (plan.nombre ?? '').trim();
  const normalizedName = nombre.toLowerCase();
  if (normalizedName === 'free' || normalizedName === 'gratis') return PLAN_LABELS.free;
  if (normalizedName === 'premium') return PLAN_LABELS.premium;
  return nombre || 'Plan';
}

export function planBadgeLabel(plan?: PlanLike | string | null): string {
  return planLabel(plan);
}
