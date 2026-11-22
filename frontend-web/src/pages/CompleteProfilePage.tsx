import { safeReturnPath } from '../lib/navigation';
import { FormEvent, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faUser } from '@fortawesome/free-solid-svg-icons';

import { useAuth } from '../auth/AuthProvider.tsx';
import AuthLayout from '../components/AuthLayout.tsx';

export default function CompleteProfilePage() {
  const { createProfile, needsProfile, context, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const next = safeReturnPath(nextParam);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!needsProfile && context) {
    return <Navigate to={next ?? '/portal'} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!nombre.trim() || !apellido.trim()) {
      setError('Completa tu nombre y apellido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await createProfile(nombre.trim(), apellido.trim());
      navigate(
        next ?? (
          updated?.es_admin_sistema
            ? '/portal/admin'
            : updated?.membresias[0]
              ? `/portal/negocio/${updated.membresias[0].negocio.id}`
              : '/acceso-restringido'
        ),
        { replace: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear tu perfil.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card-head">
          <h1>Completa tu perfil</h1>
          <p>Necesitamos tu nombre para asociar tu cuenta de Benefy.</p>
        </div>
        {error ? (
          <div className="auth-alert auth-alert--error" role="alert">
            <FontAwesomeIcon icon={faCircleExclamation} />
            <p>{error}</p>
          </div>
        ) : null}
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="profile-name">Nombre</label>
            <div className="auth-control">
              <span className="auth-control-icon"><FontAwesomeIcon icon={faUser} /></span>
              <input id="profile-name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="profile-lastname">Apellido</label>
            <div className="auth-control">
              <span className="auth-control-icon"><FontAwesomeIcon icon={faUser} /></span>
              <input id="profile-lastname" value={apellido} onChange={(e) => setApellido(e.target.value)} required />
            </div>
          </div>
          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? 'Guardando...' : 'Continuar'}</span>
          </button>
        </form>
        <p className="auth-signup">
          <button type="button" className="auth-text-link" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
