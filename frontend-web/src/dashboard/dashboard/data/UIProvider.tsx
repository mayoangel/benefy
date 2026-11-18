import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Toast from '../components/Toast';
type ScreenState = 'data' | 'loading' | 'empty' | 'error';
type UI = { notify: (message: string) => void; online: boolean; screen: ScreenState; setScreen: (state: ScreenState) => void };
const UIContext = createContext<UI | null>(null);
export function UIProvider({ children, demoControls = true }: { children: ReactNode; demoControls?: boolean }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [screens, setScreens] = useState<Record<string, ScreenState>>({});
  const { pathname } = useLocation();
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const screen = screens[pathname] || 'data';
  return <UIContext.Provider value={{ notify: message => setToast({ message, id: performance.now() }), online, screen, setScreen: state => setScreens(previous => ({ ...previous, [pathname]: state })) }}>
    <div className="bd-ui">{!online && <div className="bd-offline" role="status">Sin conexión: no se pueden confirmar operaciones</div>}{children}{toast && <Toast key={toast.id} message={toast.message} onClose={() => setToast(null)} />}{import.meta.env.DEV && demoControls && <label className="bd-dev-state">Vista de prueba<select value={screen} onChange={e => setScreens(previous => ({ ...previous, [pathname]: e.target.value as ScreenState }))}>
      <option value="data">Con datos</option>
      <option value="loading">Cargando</option>
      <option value="empty">Vacío</option>
      <option value="error">Error</option>
    </select>
    </label>}</div>
  </UIContext.Provider>;
}
export function useUI() { const value = useContext(UIContext); if (!value) throw new Error('Falta el contexto de interfaz.'); return value; }
