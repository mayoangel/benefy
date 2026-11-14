import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faCircleCheck,
  faEnvelope,
  faEye,
  faEyeSlash,
  faIdBadge,
  faLock,
  faStore,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/LogoR.png';
import AuthLayout, { GoogleMark, MicrosoftMark } from '../components/AuthLayout.tsx';

type Strength = {
  score: number;
  label: string;
  tone: 'muted' | 'error' | 'warn' | 'good' | 'strong';
};

function passwordStrength(value: string): Strength {
  if (!value) {
    return { score: 0, label: 'Introduce tu contraseña', tone: 'muted' };
  }

  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 8 && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { score, label: 'Seguridad débil', tone: 'error' };
  if (score === 2) return { score, label: 'Seguridad regular', tone: 'warn' };
  if (score === 3) return { score, label: 'Seguridad buena', tone: 'good' };
  return { score, label: 'Excelente seguridad', tone: 'strong' };
}

export default function RegisterPage() {
  const [business, setBusiness] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const strength = passwordStrength(password);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <AuthLayout>
      <div className="auth-stage">
        <span className="auth-glow auth-glow-mint" aria-hidden="true" />
        <span className="auth-glow auth-glow-navy" aria-hidden="true" />
        <div className="auth-card auth-card-wide auth-card-register">
          <div className="auth-card-head">
            <img className="auth-card-logo auth-card-logo-lg" src={logo} alt="Benefy" width="500" height="331" />
            <span className="auth-pill">
              <i />
              Prueba Pro 14 Días
            </span>
            <h1>Crear cuenta en Benefy</h1>
            <p>Comienza tu prueba gratuita de 14 días sin tarjeta de crédito</p>
          </div>

          <form className="auth-form auth-form-tight" id="signup-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="business-name">Nombre comercial o de tu negocio</label>
              <div className="auth-control">
                <span className="auth-control-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faStore} />
                </span>
                <input
                  id="business-name"
                  type="text"
                  required
                  placeholder="Ej: Café Blend Roma"
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="full-name">Nombre completo del responsable</label>
              <div className="auth-control">
                <span className="auth-control-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faIdBadge} />
                </span>
                <input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Ej: Valeria Sandoval Ruiz"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="work-email">Correo electrónico comercial</label>
              <div className="auth-control">
                <span className="auth-control-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  id="work-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="hola@tudominio.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password-input">Contraseña</label>
              <div className="auth-control">
                <span className="auth-control-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="auth-eye"
                  id="toggle-password"
                  type="button"
                  aria-label="Mostrar u ocultar contraseña"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
              <div className="auth-strength" aria-live="polite">
                <div className="auth-strength-bars">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={step <= strength.score ? `is-${strength.tone}` : undefined}
                    />
                  ))}
                </div>
                <div className="auth-strength-meta">
                  <span className={`is-${strength.tone}`}>{strength.label}</span>
                  <span>8+ carácteres</span>
                </div>
              </div>
            </div>

            <label className="auth-terms">
              <input
                id="terms-check"
                type="checkbox"
                required
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                Acepto los <Link to="/">Términos de Servicio</Link> y la{' '}
                <Link to="/">Política de Privacidad</Link> de Benefy.
              </span>
            </label>

            <button className="auth-submit auth-submit-arrow" id="submit-btn" type="submit">
              <span>Crear mi cuenta gratis</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </form>

          <div className="auth-divider">
            <span>O regístrate con</span>
          </div>

          <div className="auth-alt auth-alt-soft">
            <button type="button">
              <GoogleMark />
              <span>Workspace</span>
            </button>
            <button type="button">
              <MicrosoftMark />
              <span>Microsoft</span>
            </button>
          </div>

          <p className="auth-switch">
            ¿Ya tienes una cuenta comercial?
            <Link to="/login">Iniciar sesión</Link>
          </p>
        </div>

        <ul className="auth-assurances">
          <li>
            <FontAwesomeIcon icon={faCircleCheck} />
            Sin compromiso
          </li>
          <li>
            <FontAwesomeIcon icon={faLock} />
            Cifrado SSL 256-bit
          </li>
          <li>
            <FontAwesomeIcon icon={faUserShield} />
            Cumplimiento RGPD
          </li>
        </ul>
      </div>
    </AuthLayout>
  );
}
