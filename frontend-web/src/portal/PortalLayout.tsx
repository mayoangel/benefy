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
import { PortalIcon, PortalRoleBadge } from './components/PortalUI';
import { areaForRelativePath, areasForRole } from './navigation.ts';

export default function PortalLayout() {
  const { context, profile, signOut, session } = useAuth();
  const { negocioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 860px)').matches);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
  const base = id ? `/portal/negocio/${id}` : '/portal/admin';
  const relativePath = id && location.pathname.startsWith(base)
    ? location.pathname.slice(base.length).replace(/^\/+/, '')
    : '';
  const areas = useMemo(() => areasForRole(rol), [rol]);
  const activeArea = useMemo(
    () => areaForRelativePath(areas, relativePath),
    [areas, relativePath],
  );

  useEffect(() => {
    if (!activeArea?.items?.length) return;
    setOpenGroups((actual) => (
      actual[activeArea.key] ? actual : { ...actual, [activeArea.key]: true }
    ));
  }, [activeArea]);

  function toggleGroup(key: string) {
    setOpenGroups((actual) => ({ ...actual, [key]: !actual[key] }));
  }

  function destination(path: string, extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (selectedSucursal) params.set('sucursal', selectedSucursal);
    Object.entries(extra ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const search = params.toString();
    return {
      pathname: `${base}${path ? `/${path}` : ''}`,
      search: search ? `?${search}` : '',
    };
  }

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
        <div className="portal-sidebar-head">
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
        </div>

        <nav className="portal-nav" aria-label="Navegación del portal">
          {esAdmin ? (
            <div className="portal-nav-area">
              <span className="portal-nav-section-label">Plataforma</span>
              <NavLink end to="/portal/admin" className={({ isActive }) => `portal-nav-area-link${isActive ? ' is-active' : ''}`}>
                <PortalIcon name="admin" /><span>Administración global</span>
              </NavLink>
            </div>
          ) : areas.map((area) => {
            if (area.path !== undefined) {
              const active = activeArea?.key === area.key;
              return (
                <NavLink
                  end
                  key={area.key}
                  to={destination(area.path)}
                  className={() => `portal-nav-area-link${active ? ' is-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <PortalIcon name={area.icon} />
                  <span>{area.label}</span>
                </NavLink>
              );
            }
            const open = Boolean(openGroups[area.key]);
            const current = activeArea?.key === area.key;
            return (
              <div className={`portal-nav-area${current ? ' is-current' : ''}`} key={area.key}>
                <button
                  type="button"
                  className="portal-nav-toggle"
                  aria-expanded={open}
                  aria-controls={`portal-nav-${area.key}`}
                  onClick={() => toggleGroup(area.key)}
                >
                  <PortalIcon name={area.icon} />
                  <span>{area.label}</span>
                  <span className="portal-nav-chevron" aria-hidden="true">
                    <PortalIcon name="chevron" />
                  </span>
                </button>
                <div
                  id={`portal-nav-${area.key}`}
                  className="portal-nav-submenu"
                  hidden={!open}
                >
                  {(area.items ?? []).map((item) => (
                    <NavLink
                      end
                      key={item.path}
                      to={destination(item.path)}
                      className={({ isActive }) => `portal-nav-sublink${isActive ? ' is-active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <PortalIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
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
