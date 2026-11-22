import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faRotate } from '@fortawesome/free-solid-svg-icons';

import { useAuth } from '../auth/AuthProvider.tsx';
import AuthLayout from '../components/AuthLayout.tsx';
import { portalDestination } from '../lib/portal.ts';

export default function FinishRegistrationPage() {
  const {
    context,
    loading,
    needsProfile,
    onboardingError,
    retryOnboarding,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="portal-loading">
        <span className="portal-spinner" aria-hidden="true" />
        <p>Preparando tu negocio...</p>
      </div>
    );
  }
  if (needsProfile) {
    return <Navigate to="/completar-perfil" replace />;
  }
  if (context?.puede_portal) {
    return <Navigate to={portalDestination(context)} replace />;
  }

  async function reintentar() {
    setBusy(true);
    try {
      const actualizado = await retryOnboarding();
      if (actualizado?.puede_portal) {
        navigate(portalDestination(actualizado), { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-head">
          <span className="auth-pill"><i />Registro comercial</span>
          <h1>No pudimos terminar de crear tu negocio</h1>
          <p>
            Tu cuenta y los datos del registro siguen guardados. Puedes
            reintentar sin volver a registrarte ni capturar el formulario otra vez.
          </p>
        </div>
        <div className="auth-alert auth-alert--error" role="alert">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <p>{onboardingError ?? 'No se pudo completar la operación.'}</p>
        </div>
        <button
          className="auth-submit"
          type="button"
          onClick={() => void reintentar()}
          disabled={busy}
        >
          <FontAwesomeIcon icon={faRotate} />
          <span>{busy ? 'Reintentando...' : 'Reintentar'}</span>
        </button>
        <p className="auth-signup">
          <button type="button" className="auth-text-link" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
          {' · '}
          <Link className="auth-text-link" to="/login">Volver al inicio de sesión</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
