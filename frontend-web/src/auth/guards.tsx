import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthProvider.tsx';

function LoadingScreen() {
  return (
    <div className="portal-loading">
      <span className="portal-spinner" aria-hidden="true" />
      <p>Cargando tu cuenta...</p>
    </div>
  );
}

export function RequireSession() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

export function RequirePortalAccess() {
  const { context, loading, needsProfile } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (needsProfile) {
    return <Navigate to="/completar-perfil" replace />;
  }
  if (!context) {
    return <Navigate to="/acceso-restringido" replace />;
  }
  if (!context.puede_portal) {
    return <Navigate to="/acceso-restringido" replace />;
  }
  if (!context.es_admin_sistema && context.membresias.length === 0) {
    return <Navigate to="/acceso-restringido" replace />;
  }
  if (location.pathname === '/portal') {
    return <Outlet />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { context } = useAuth();
  if (!context?.es_admin_sistema) {
    return <Navigate to="/portal" replace />;
  }
  return <Outlet />;
}
