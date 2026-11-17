import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
export function useRequestGuard(businessId: number) {
  const { session, context } = useAuth();
  const scope = JSON.stringify([session?.user.id, businessId, context?.membresias, context?.es_admin_sistema]);
  const current = useRef({scope, sequence: 0});
  if (current.current.scope !== scope) current.current = {scope, sequence: current.current.sequence + 1};
  useEffect(() => () => { current.current.sequence++; }, []);
  return useCallback(() => {
    const sequence = ++current.current.sequence;
    return () => current.current.scope === scope && current.current.sequence === sequence;
  }, [scope]);
}
