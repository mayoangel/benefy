import { useRequestGuard } from './useRequestGuard';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.ts';
import type { PlanNegocio } from '../../lib/types.ts';

export function usePlan(negocioId: number) {
  const [plan, setPlan] = useState<PlanNegocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestGuard = useRequestGuard(negocioId);
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBusinessPlan(negocioId);
      if (vigente()) setPlan(data);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar el plan.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [negocioId, requestGuard]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { plan, loading, error, reload: cargar };
}
