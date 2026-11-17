import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.ts';
import type { PlanNegocio } from '../../lib/types.ts';

export function usePlan(negocioId: number) {
  const [plan, setPlan] = useState<PlanNegocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlan(await api.getBusinessPlan(negocioId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el plan.');
    } finally {
      setLoading(false);
    }
  }, [negocioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { plan, loading, error, reload: cargar };
}
