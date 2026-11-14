import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCircleCheck,
  faCircleInfo,
  faEnvelope,
  faEnvelopeOpenText,
  faKey,
} from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/LogoR.png';
import AuthLayout from '../components/AuthLayout.tsx';

function isCorporateEmail(value: string) {
  return value.includes('@') && value.includes('.');
}

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const emailLooksValid = isCorporateEmail(email.trim());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailLooksValid) return;
    setSent(true);
  }

  return (
    <AuthLayout>
      <div className="auth-stage">
        <span className="auth-glow auth-glow-mint auth-glow-top" aria-hidden="true" />
        <span className="auth-glow auth-glow-navy auth-glow-bottom" aria-hidden="true" />
        <div className="auth-card auth-card-wide">
          <div className="auth-logo-plate">
            <img src={logo} alt="Benefy" width="500" height="331" />
          </div>

          <div className="auth-secure">
            <FontAwesomeIcon icon={faKey} />
            Recuperación Segura
          </div>

          <div className="auth-card-head auth-card-head-left">
            <h1>Recuperar contraseña</h1>
            <p>
              Ingresa tu correo electrónico registrado y te enviaremos las instrucciones para
              restablecer tu acceso.
            </p>
          </div>

          {sent ? (
            <div className="auth-sent" id="success-feedback">
              <span className="auth-sent-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faEnvelopeOpenText} />
              </span>
              <h2>¡Enlace enviado!</h2>
              <p>
                Hemos enviado las instrucciones a tu correo. Revisa tu bandeja de entrada en los
                próximos instantes.
              </p>
              <button type="button" onClick={() => setSent(false)}>
                Reenviar enlace
              </button>
            </div>
          ) : (
            <form className="auth-form" id="recovery-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="corporate-email">Correo electrónico comercial</label>
                <div className="auth-control">
                  <span className="auth-control-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <input
                    id="corporate-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="gerencia@tudominio.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  {emailLooksValid ? (
                    <span className="auth-valid" aria-hidden="true">
                      <FontAwesomeIcon icon={faCircleCheck} />
                    </span>
                  ) : null}
                </div>
                <p className="auth-hint">
                  Asociado a tu cuenta corporativa o portal de beneficios B2B.
                </p>
              </div>

              <button className="auth-submit auth-submit-arrow auth-submit-tall" type="submit">
                <span>Enviar enlace de recuperación</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </form>
          )}

          <div className="auth-note">
            <FontAwesomeIcon icon={faCircleInfo} />
            <p>
              Si no recibes el correo en unos minutos, revisa tu carpeta de correo no deseado
              (spam) o <Link to="/precios">contacta a soporte</Link>.
            </p>
          </div>

          <p className="auth-return">
            <Link to="/login">
              <FontAwesomeIcon icon={faArrowLeft} />
              Volver a Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
