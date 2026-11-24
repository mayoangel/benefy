import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ResolverQrResultado, VisitaResultado } from '../lib/api';

type ScanSessionValue = {
  resolution: ResolverQrResultado | null;
  result: VisitaResultado | null;
  setResolution: (value: ResolverQrResultado | null) => void;
  setResult: (value: VisitaResultado | null) => void;
  clear: () => void;
};

const ScanSessionContext = createContext<ScanSessionValue | null>(null);

export function ScanSessionProvider({
  children,
  accountId,
}: {
  children: ReactNode;
  accountId?: string;
}) {
  const [resolution, setResolution] = useState<ResolverQrResultado | null>(null);
  const [result, setResult] = useState<VisitaResultado | null>(null);
  const [previousAccount, setPreviousAccount] = useState(accountId);
  if (previousAccount !== accountId) {
    setPreviousAccount(accountId);
    setResolution(null);
    setResult(null);
  }
  const clear = useCallback(() => {
    setResolution(null);
    setResult(null);
  }, []);
  const value = useMemo(
    () => ({ resolution, result, setResolution, setResult, clear }),
    [resolution, result, clear],
  );
  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}

export function useScanSession() {
  const value = useContext(ScanSessionContext);
  if (!value) throw new Error('Falta el proveedor de sesión de escaneo');
  return value;
}
