import { forwardRef, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { nombreRol } from '../../lib/portal';

const paths: Record<string, string> = {
  resumen: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  inicio: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  actividad: 'M3 12h4l2.5-6 4 12L16 12h5',
  fidelizacion: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z',
  administracion: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 6v6',
  chevron: 'm6 9 6 6 6-6',
  clientes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  visitas: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  canjes: 'M7 7h14l-4-4M17 17H3l4 4M21 7v5M3 17v-5',
  cupones: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6ZM15 6v3m0 2v2m0 2v3',
  puntos: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z',
  tarjetas: 'M4 4h16v16H4V4Zm4 5h.01M12 9h.01M16 9h.01M8 15h.01M12 15h.01M16 15h.01',
  recompensas: 'M3 8h18v4H3V8Zm2 4v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z',
  alianzas: 'M8 12a4 4 0 0 1 0-8h3M16 12a4 4 0 0 1 0 8h-3M9 16H7a4 4 0 0 1 0-8h2m6 0h2a4 4 0 0 1 0 8h-2M8 12h8',
  equipo: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6m-3-3h6',
  sucursales: 'M4 10v11h16V10M3 10l2-7h14l2 7M8 21v-7h8v7M3 10h18',
  configuracion: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  suscripcion: 'M3 7h18v10H3V7Zm0 4h18M7 15h3',
  admin: 'M4 21v-9l8-5 8 5v9M9 21v-5h6v5M3 21h18M8 9V5h8v4',
  ia: 'M12 2.8l1.7 5.5L19.2 10l-5.5 1.7L12 17.2l-1.7-5.5L4.8 10l5.5-1.7L12 2.8Zm6.5 11.2.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  salir: 'M9 4H4v16h5M14 8l4 4-4 4M8 12h12',
};

export function PortalIcon({ name }: { name: string }) {
  return <svg className="portal-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.resumen} /></svg>;
}

export function PortalPageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: ReactNode; children?: ReactNode }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Benefy`;
    return () => { document.title = previous; };
  }, [title]);
  return <header className="portal-page-head"><div><span className="portal-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children ? <div className="portal-page-actions">{children}</div> : null}</header>;
}

export function PortalTable({ label, busy, children }: { label: string; busy?: boolean; children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const hint = useId();
  useEffect(() => {
    const wrapper = region.current;
    const table = wrapper?.querySelector('table');
    if (!wrapper || !table || typeof ResizeObserver === 'undefined') return;
    const measure = () => setOverflow(table.scrollWidth > wrapper.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);
  return <><div ref={region} tabIndex={0} role="region" aria-label={label} aria-describedby={overflow ? hint : undefined} aria-busy={busy} className="portal-table-wrap"><table className="portal-table"><caption className="portal-sr-only">{label}</caption>{children}</table></div>{overflow ? <p className="portal-table-hint" id={hint}>Desplaza la tabla para consultar todas las columnas.</p> : null}</>;
}

export function PortalRoleBadge({ role, className = 'portal-badge' }: { role: string | null | undefined; className?: string }) {
  return <span className={`${className} portal-role-badge`} data-role={role}>{nombreRol(role)}</span>;
}

export const PortalForm = forwardRef<HTMLFormElement, ComponentPropsWithoutRef<'form'>>(function PortalForm({ className = '', children, ...props }, ref) {
  return <form {...props} ref={ref} className={`portal-panel portal-form ${className}`}>{children}</form>;
});

export function PortalFormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <fieldset className="portal-form-section"><legend>{title}</legend>{description ? <p className="portal-muted">{description}</p> : null}<div className="portal-form-grid">{children}</div></fieldset>;
}

export function PortalMetric({ label, value, detail, featured = false }: { label: string; value: ReactNode; detail: ReactNode; featured?: boolean }) {
  return <article className={`portal-kpi${featured ? ' is-featured' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
