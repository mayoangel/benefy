import { useGuardedNavigation } from '../hooks/useUnsavedChanges';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../data/DemoDataProvider';
import { closeWebSession } from '../../lib/webAuth';
import { useUI } from '../data/UIProvider';
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const { preferences } = useDemoData();
  const guard = useGuardedNavigation();
  const navigate = useNavigate();
  const { notify } = useUI();
  async function logout() {
    try {
      await closeWebSession();
    } catch {
      notify('No se pudo confirmar el cierre de sesión con el servidor.');
    }
    navigate('/login');
  }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const click = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="bd-account" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
    <button className="bd-avatar" ref={button} aria-label="Menú de cuenta" aria-haspopup="menu" aria-expanded={open} aria-controls="bd-account-menu" onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }} onClick={() => setOpen(!open)}>AD</button>{open && <div id="bd-account-menu" className="bd-account-menu" role="menu" onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); } }} ref={menu} aria-label="Cuenta">
      <strong>{preferences.name}</strong>
      <span>{preferences.email}</span>
      <span>Administrador de negocio</span>
      <button role="menuitem" className="bd-secondary" onClick={() => guard(() => { void logout(); })}>Cerrar sesión</button>
    </div>}</div>;
}
