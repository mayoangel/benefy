import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider.tsx';
import logoMark from '../assets/logo_no_name.png';
import { membresiaDelNegocio } from '../lib/portal.ts';
import type { RolComercio } from '../lib/types.ts';
import { PortalIcon, PortalRoleBadge } from './components/PortalUI';

const NAV_GROUPS = [
  { label: 'Actividad', paths: ['', 'clientes', 'visitas', 'canjes', 'cupones'] },
  { label: 'Fidelización', paths: ['puntos', 'tarjetas', 'recompensas'] },
  { label: 'Crecimiento', paths: ['alianzas'] },
  { label: 'Tu negocio', paths: ['suscripcion', 'sucursales', 'equipo', 'configuracion'] },
];

function navItems(rol: RolComercio | null) {
  if (rol === 'dueno') {
    return [
      { label: 'Resumen', path: '' },
      { label: 'Suscripción', path: 'suscripcion' },
      { label: 'Configuración', path: 'configuracion' },
      { label: 'Sucursales', path: 'sucursales' },
      { label: 'Puntos', path: 'puntos' },
      { label: 'Tarjetas', path: 'tarjetas' },
      { label: 'Recompensas', path: 'recompensas' },
      { label: 'Alianzas', path: 'alianzas' },
      { label: 'Equipo', path: 'equipo' },
      { label: 'Visitas', path: 'visitas' },
      { label: 'Canjes', path: 'canjes' },
      { label: 'Cupones', path: 'cupones' },
      { label: 'Clientes', path: 'clientes' },
    ];
  }
  if (rol === 'supervisor') {
    return [
      { label: 'Resumen', path: '' },
      { label: 'Equipo', path: 'equipo' },
      { label: 'Visitas', path: 'visitas' },
      { label: 'Canjes', path: 'canjes' },
    ];
  }
  if (rol === 'empleado') {
    return [
      { label: 'Resumen', path: '' },
      { label: 'Visitas', path: 'visitas' },
      { label: 'Canjes', path: 'canjes' },
    ];
  }
  return [];
}

export default function PortalLayout() {
  const { context, profile, signOut, session } = useAuth();
  const { negocioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 860px)').matches);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const change = () => { setMobile(query.matches); setMenuOpen(false); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (sidebar.current) sidebar.current.inert = mobile && !menuOpen;
    if (main.current) main.current.inert = mobile && menuOpen;
    if (!mobile || !menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (main.current) main.current.inert = false; trigger.current?.focus(); };
  }, [mobile, menuOpen]);
  function drawerKey(event: React.KeyboardEvent) {
    if (!mobile || !menuOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); }
    if (event.key === 'Tab') {
      const nodes = sidebar.current?.querySelectorAll<HTMLElement>('a[href],button,select');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  const id = negocioId ? Number(negocioId) : null;
  const esAdmin = Boolean(context?.es_admin_sistema);
  const membresia = id ? membresiaDelNegocio(context, id) : null;
  const rol = membresia?.rol_comercio ?? null;
  const planNegocio = id
    ? context?.negocios.find((negocio) => negocio.id === id)?.plan ?? null
    : null;

  const sucursales = useMemo(() => {
    if (!context || !id) return [];
    return context.sucursales.filter((sucursal) => sucursal.negocio === id);
  }, [context, id]);

  if (!context) {
    return <Navigate to="/acceso-restringido" replace />;
  }
  if (id && !membresia) {
    return <Navigate to="/portal" replace />;
  }

  const selectedSucursal = searchParams.get('sucursal') ?? '';
  const items = navItems(rol);
  const base = id ? `/portal/negocio/${id}` : '/portal/admin';

  function cambiarNegocio(value: string) {
    if (!value) return;
    navigate(`/portal/negocio/${value}`);
  }

  function cambiarSucursal(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('sucursal', value);
    else next.delete('sucursal');
    setSearchParams(next);
  }

  return (
    <div className="portal-shell">
      <a className="portal-skip" href="#portal-title">Saltar al contenido</a>
      <aside ref={sidebar} id="portal-navigation" role={mobile && menuOpen ? 'dialog' : undefined}
        aria-modal={mobile && menuOpen ? true : undefined} aria-label="Portal de negocios" onKeyDown={drawerKey} className={`portal-sidebar${menuOpen ? ' is-open' : ''}`}>
        {mobile ? <button className="portal-drawer-close" type="button" onClick={() => setMenuOpen(false)}>Cerrar menú</button> : null}
        <div className="portal-brand">
          <span className="portal-brand-mark" aria-hidden="true">
            <img src={logoMark} alt="" width="488" height="319" />
          </span>
          <div>
            <strong>Benefy</strong>
            <small>{esAdmin ? 'Administración global' : 'Portal de negocios'}</small>
          </div>
        </div>

        {!esAdmin && context.membresias.length > 1 ? (
          <label className="portal-selector" htmlFor="portal-portallayout-1">
            <span>Negocio</span>
            <select id="portal-portallayout-1" name="portal-portallayout-1" value={id ?? ''} onChange={(event) => cambiarNegocio(event.target.value)}>
              {context.membresias.map((item) => (
                <option key={item.id} value={item.negocio.id}>
                  {item.negocio.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!esAdmin && id && sucursales.length > 1 ? (
          <label className="portal-selector" htmlFor="portal-portallayout-2">
            <span>Sucursal</span>
            <select id="portal-portallayout-2" name="portal-portallayout-2" value={selectedSucursal} onChange={(event) => cambiarSucursal(event.target.value)}>
              {rol === 'dueno' ? <option value="">Todas las sucursales</option> : null}
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="portal-nav" aria-label="Navegación del portal">
          {esAdmin ? (
            <NavLink end to="/portal/admin" className={({ isActive }) => isActive ? 'is-active' : ''}>
              <PortalIcon name="admin" />Administración global
            </NavLink>
          ) : null}
          {!esAdmin && NAV_GROUPS.map(group => {
            const entries = group.paths.flatMap(path => items.filter(item => item.path === path));
            return entries.length ? <div className="portal-nav-group" key={group.label}>
            <span className="portal-nav-label">{group.label}</span>
            {entries.map((item) => (
            <NavLink
              end={item.path === ''}
              key={item.path}
              to={{pathname: base + (item.path ? '/' + item.path : ''), search: selectedSucursal ? '?sucursal=' + encodeURIComponent(selectedSucursal) : ''}}
              className={({ isActive }) => `portal-nav-link${isActive ? ' is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <PortalIcon name={item.path || 'resumen'} />{item.label}
            </NavLink>
          ))}</div> : null;
          })}
        </nav>

        <div className="portal-sidebar-footer">
          {rol === 'dueno' ? (
            <Link to="/registrar-negocio">Registrar otro negocio</Link>
          ) : null}
          <Link to="/">Volver al sitio</Link>
          <button type="button" onClick={() => void signOut()}><PortalIcon name="salir" />Cerrar sesión</button>
        </div>
      </aside>

      {mobile && menuOpen ? <div className="portal-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}
      <div ref={main} className="portal-main">
        <header className="portal-topbar">
          <button
            type="button"
            ref={trigger}
            aria-expanded={menuOpen}
            aria-controls="portal-navigation"
            className="portal-menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Abrir menú"
          >
            <PortalIcon name="menu" />
          </button>
          <div>
            <strong>{esAdmin ? 'Panel de plataforma' : membresia?.negocio.nombre}</strong>
            <span>{profile?.correo}</span>
          </div>
          <PortalRoleBadge className="portal-role" role={esAdmin ? 'admin_sistema' : rol} />
          {!esAdmin && planNegocio ? (
            <span className={`portal-plan-tag${planNegocio.codigo === 'premium' ? ' is-premium' : ''}`}>
              Plan {planNegocio.nombre}
            </span>
          ) : null}
        </header>
        <main className="portal-content" id="portal-title" tabIndex={-1}>
          <Outlet key={JSON.stringify([session?.user.id, id, context.membresias, context.es_admin_sistema])} />
        </main>
      </div>
    </div>
  );
}
