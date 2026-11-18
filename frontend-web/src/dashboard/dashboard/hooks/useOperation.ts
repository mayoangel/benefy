import { useEffect, useRef, useState } from 'react';
import { useUI } from '../data/UIProvider';
export default function useOperation() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  const { notify } = useUI();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run(action: () => void, message: string) {
    if (running.current) return false;
    if (!navigator.onLine) { notify('Sin conexión: no se pueden confirmar operaciones'); return false; }
    running.current = true; setBusy(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (!alive.current) return false;
      if (!navigator.onLine) { notify('La conexión se perdió. Tus cambios siguen pendientes.'); return false; }
      action(); notify(message); return true;
    } catch { notify('No pudimos completar la operación. Intenta de nuevo.'); return false; }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  return { busy, run };
}
