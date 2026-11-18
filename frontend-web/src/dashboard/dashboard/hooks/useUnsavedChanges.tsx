import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
type Guard = { setDirty: (dirty: boolean) => void; request: (action: () => void) => void };
const GuardContext = createContext<Guard | null>(null);
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const [prompt, setPrompt] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const index = useRef<number>(window.history.state?.idx ?? 0);
  const restoring = useRef(false);
  const bypass = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
    if (!value) { pending.current = null; setPrompt(false); }
  }, []);
  const request = useCallback((action: () => void) => { if (!dirty.current) { action(); return; } pending.current = action; setPrompt(true); }, []);
  useEffect(() => { index.current = window.history.state?.idx ?? 0; }, [location]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!dirty.current || !link || link.target === '_blank' || link.hasAttribute('download') || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const url = new URL(link.href); if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault(); e.stopPropagation();
      request(() => { if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash); else window.location.assign(url.href); });
    };
    const pop = (e: PopStateEvent) => {
      if (restoring.current) { restoring.current = false; e.stopImmediatePropagation(); return; }
      if (bypass.current) { bypass.current = false; return; }
      if (!dirty.current) return;
      const target = e.state?.idx ?? 0;
      const delta = index.current - target;
      if (!delta) return;
      e.stopImmediatePropagation(); restoring.current = true; window.history.go(delta);
      request(() => { bypass.current = true; window.history.go(-delta); });
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true); window.addEventListener('popstate', pop, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', pop, true); };
  }, [navigate, request]);
  return <GuardContext.Provider value={{ setDirty, request }}>{children}{prompt && <ConfirmModal title="Tienes cambios sin guardar" cancelLabel="Continuar editando" message="Si sales ahora, perderás los cambios de este formulario." confirmLabel="Descartar cambios" onClose={() => { pending.current = null; setPrompt(false); }} onConfirm={() => { const action = pending.current; dirty.current = false; pending.current = null; setPrompt(false); action?.(); }} />}</GuardContext.Provider>;
}
export default function useUnsavedChanges(dirty: boolean) {
  const guard = useContext(GuardContext);
  useEffect(() => { guard?.setDirty(dirty); return () => guard?.setDirty(false); }, [dirty, guard?.setDirty]);
  return { requestClose: (action: () => void) => guard ? guard.request(action) : action() };
}
export function useGuardedNavigation() { const guard = useContext(GuardContext); return (action: () => void) => guard ? guard.request(action) : action(); }
