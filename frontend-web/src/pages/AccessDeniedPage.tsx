import { Link, Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

import { useAuth } from '../auth/AuthProvider.tsx';
import AuthLayout from '../components/AuthLayout.tsx';

export default function AccessDeniedPage() {
  const { context, needsProfile, signOut, loading } = useAuth();

  if (loading) {
    return <div className="portal-loading"><span className="portal-spinner" /><p>Cargando...</p></div>;
  }
  if (needsProfile) {
    return <Navigate to="/completar-perfil" replace />;
  }
  if (context?.puede_portal) {
    return <Navigate to="/portal" replace />;
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-head">
          <span className="auth-pill"><i />Portal de negocios</span>
          <h1>Tu cuenta no tiene un negocio asociado</h1>
          <p>
            El portal web está diseñado para dueños, supervisores y empleados de un negocio.
            La experiencia móvil del cliente todavía se encuentra en integración.
          </p>
        </div>
        <div className="auth-note">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <p>
            Si quieres registrar tu negocio, completa el formulario y crearemos tu membresía
            de dueño.
          </p>
        </div>
        <Link className="auth-submit auth-submit-arrow" to="/registrar-negocio">
          <FontAwesomeIcon icon={faBuilding} />
          <span>Registrar mi negocio</span>
        </Link>
        <p className="auth-signup">
          <button type="button" className="auth-text-link" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
