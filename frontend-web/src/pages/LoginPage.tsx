import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faCircleCheck,
  faCircleExclamation,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/LogoR.png';
import AuthLayout, { GoogleMark } from '../components/AuthLayout.tsx';

type AlertKind = 'error' | 'success';

type AlertState = {
  kind: AlertKind;
  text: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== 'idle') return;

    const emailVal = email.trim();
    if (!emailVal || !password) {
      setAlert({ kind: 'error', text: 'Por favor completa los campos requeridos.' });
      return;
    }
    if (!emailVal.includes('@') || !emailVal.includes('.')) {
      setAlert({ kind: 'error', text: 'Formato de correo electrónico inválido' });
      return;
    }

    setAlert(null);
    setStatus('loading');
    timer.current = window.setTimeout(() => {
      setStatus('success');
      setAlert({
        kind: 'success',
        text: 'Sesión iniciada con éxito. Redirigiendo a tu panel...',
      });
    }, 1200);
  }

  const busy = status !== 'idle';

  return (
    <AuthLayout>
        <div className="auth-card">
          <div className="auth-card-head">
            <img className="auth-card-logo" src={logo} alt="" width="500" height="331" />
            <h1>Iniciar sesión</h1>
            <p>Ingresa a tu cuenta para continuar</p>
          </div>

          {alert ? (
            <div className={`auth-alert auth-alert--${alert.kind}`} role="alert">
              <FontAwesomeIcon
                icon={alert.kind === 'error' ? faCircleExclamation : faCircleCheck}
              />
              <p>{alert.text}</p>
            </div>
          ) : null}

          <form className="auth-form" id="form-credentials" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-user">Correo comercial o usuario</label>
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

            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={busy}
              />
              <span>Recordarme</span>
            </label>

            <button
              className={`auth-submit${status === 'success' ? ' is-success' : ''}`}
              id="btn-primary-login"
              type="submit"
              disabled={busy}
            >
              {status === 'loading' ? <span className="auth-spinner" aria-hidden="true" /> : null}
              {status === 'success' ? (
                <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
              ) : null}
              <span>
                {status === 'loading'
                  ? 'Verificando credenciales...'
                  : status === 'success'
                    ? 'Autenticación exitosa'
                    : 'Iniciar sesión'}
              </span>
            </button>
          </form>

          <div className="auth-divider">
            <span>O continúa con</span>
          </div>

          <div className="auth-alt">
            <button type="button">
              <GoogleMark />
              <span>Google</span>
            </button>
            <button type="button">
              <FontAwesomeIcon icon={faBolt} />
              <span>Magic Link</span>
            </button>
          </div>

          <p className="auth-signup">
            ¿No tienes cuenta?{' '}
            <Link to="/registro">Regístrate o prueba gratis</Link>
          </p>
        </div>
    </AuthLayout>
  );
}
