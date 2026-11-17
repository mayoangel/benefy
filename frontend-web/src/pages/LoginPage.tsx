import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/LogoR.png';
import AuthLayout from '../components/AuthLayout.tsx';
import { useAuth } from '../auth/AuthProvider.tsx';
import { portalDestination } from '../lib/portal.ts';

type AlertState = {
  kind: 'error';
  text: string;
};

export default function LoginPage() {
  const { signIn, session, loading, onboardingError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const confirmado = new URLSearchParams(location.search).get('confirmado') === '1';

  useEffect(() => {
    if (loading || busy || !session) return;
    if (onboardingError) {
      navigate('/completar-registro', { replace: true });
      return;
    }
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    navigate(next && next.startsWith('/') ? next : '/portal', { replace: true });
  }, [busy, loading, location.search, navigate, onboardingError, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const emailVal = email.trim();
    if (!emailVal || !password) {
      setAlert({ kind: 'error', text: 'Por favor completa los campos requeridos.' });
      return;
    }
    if (!emailVal.includes('@') || !emailVal.includes('.')) {
      setAlert({ kind: 'error', text: 'Formato de correo electrónico inválido.' });
      return;
    }

    setAlert(null);
    setBusy(true);
    try {
      const result = await signIn(emailVal, password);
      const params = new URLSearchParams(location.search);
      const next = params.get('next');
      if (result.needsProfile) {
        navigate(
          `/completar-perfil${next ? `?next=${encodeURIComponent(next)}` : ''}`,
          { replace: true },
        );
        return;
      }
      if (!result.context) {
        navigate('/completar-registro', { replace: true });
        return;
      }
      navigate(next && next.startsWith('/') ? next : portalDestination(result.context), {
        replace: true,
      });
    } catch (err) {
      setAlert({
        kind: 'error',
        text: err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card-head">
          <img className="auth-card-logo" src={logo} alt="" width="500" height="331" />
          <h1>Iniciar sesión</h1>
          <p>Accede al portal de negocios de Benefy</p>
        </div>

        {confirmado ? (
          <div className="auth-note" role="status">
            <FontAwesomeIcon icon={faCircleCheck} />
            <p>
              Correo confirmado. {session
                ? 'Estamos preparando tu negocio...'
                : 'Inicia sesión para terminar tu registro automáticamente.'}
            </p>
          </div>
        ) : null}

        {alert ? (
          <div className="auth-alert auth-alert--error" role="alert">
            <FontAwesomeIcon icon={faCircleExclamation} />
            <p>{alert.text}</p>
          </div>
        ) : null}

        <form className="auth-form" id="form-credentials" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="login-user">Correo comercial</label>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faEnvelope} />
              </span>
              <input
                id="login-user"
                type="email"
                autoComplete="username"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-pass">Contraseña</label>
              <Link className="auth-text-link" to="/recuperar">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="auth-control">
              <span className="auth-control-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faLock} />
              </span>
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button
                className="auth-eye"
                id="btn-toggle-eye"
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((value) => !value)}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>

          <button
            className="auth-submit"
            id="btn-primary-login"
            type="submit"
            disabled={busy}
          >
            {busy ? <span className="auth-spinner" aria-hidden="true" /> : null}
            <span>{busy ? 'Verificando credenciales...' : 'Iniciar sesión'}</span>
          </button>
        </form>

        <p className="auth-signup">
          ¿Aún no tienes cuenta?{' '}
          <Link to="/registro">Registra tu negocio</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
