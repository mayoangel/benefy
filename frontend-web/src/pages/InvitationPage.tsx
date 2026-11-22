import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider.tsx';
import AuthLayout from '../components/AuthLayout.tsx';
import { ApiError, api } from '../lib/api.ts';
import type { InvitacionResumen } from '../lib/types.ts';

export default function InvitationPage() {
  const { token = '' } = useParams();
  const { loading, needsProfile, refreshContext, signOut } = useAuth();
  const navigate = useNavigate();
  const [invitacion, setInvitacion] = useState<InvitacionResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aceptada, setAceptada] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (loading || needsProfile) return;
    let activo = true;
    api.getInvitation(token)
      .then((datos) => {
        if (activo) setInvitacion(datos);
      })
      .catch((err) => {
        if (activo) {
          setError(
            err instanceof ApiError && err.codigo === 'correo_no_coincide'
              ? 'Esta invitación pertenece a otro correo electrónico.'
              : err instanceof Error ? err.message : 'No se pudo cargar la invitación.',
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [loading, needsProfile, token]);

  if (loading || cargando) {
    return (
      <div className="portal-loading">
        <span className="portal-spinner" aria-hidden="true" />
        <p>Revisando invitación...</p>
      </div>
    );
  }
  if (needsProfile) {
    return <Navigate to={`/completar-perfil?next=/invitacion/${token}`} replace />;
  }

  async function aceptar() {
    setBusy(true);
    setError(null);
    try {
      const resultado = await api.acceptInvitation(token);
      setAceptada(resultado.negocio_id);
      await refreshContext();
      navigate(`/portal/negocio/${resultado.negocio_id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-head">
          <span className="auth-pill"><i />Invitación</span>
          <h1>Únete a un negocio en Benefy</h1>
          <p>Revisa la invitación antes de aceptar. No tendrás acceso hasta confirmarla.</p>
        </div>

        {error ? (
          <div className="auth-alert auth-alert--error" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        {invitacion ? (
          <div className="portal-panel">
            <dl className="portal-details">
              <div><dt>Negocio</dt><dd>{invitacion.negocio.nombre}</dd></div>
              <div><dt>Rol</dt><dd>{invitacion.rol_comercio}</dd></div>
              <div><dt>Sucursal</dt><dd>{invitacion.sucursal?.nombre ?? 'Todo el negocio'}</dd></div>
              <div><dt>Estado</dt><dd>{invitacion.estado}</dd></div>
              <div><dt>Expira</dt><dd>{new Date(invitacion.fecha_expiracion).toLocaleString('es-MX')}</dd></div>
            </dl>
          </div>
        ) : null}

        {invitacion?.estado === 'pendiente' ? (
          <button
            className="auth-submit"
            type="button"
            onClick={() => void aceptar()}
            disabled={busy}
          >
            {busy ? 'Aceptando...' : 'Aceptar invitación'}
          </button>
        ) : (
          <div className="auth-note">
            <p>
              Esta invitación ya no está pendiente.
              {aceptada ? ' Tu acceso fue activado.' : ' Solicita una nueva al negocio.'}
            </p>
          </div>
        )}

        <p className="auth-signup">
          <Link to="/portal">Ir al portal</Link>
          {' · '}
          <button type="button" className="auth-text-link" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
