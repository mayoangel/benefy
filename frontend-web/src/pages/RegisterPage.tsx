import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faEnvelope,
  faEye,
  faEyeSlash,
  faIdBadge,
  faLock,
  faStore,
} from '@fortawesome/free-solid-svg-icons';

import AuthLayout from '../components/AuthLayout.tsx';
import { supabase } from '../lib/supabase.ts';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenInvitacion = searchParams.get('invitacion');
  const esInvitacion = Boolean(tokenInvitacion);
  const [business, setBusiness] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError('Debes aceptar los términos para continuar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmado=1${
            tokenInvitacion
              ? `&next=${encodeURIComponent(`/invitacion/${tokenInvitacion}`)}`
              : ''
          }`,
          data: esInvitacion
            ? {
                benefy_tipo_registro: 'invitacion',
                benefy_nombre_completo: name.trim(),
              }
            : {
                benefy_tipo_registro: 'comercial',
                benefy_nombre_negocio: business.trim(),
                benefy_nombre_completo: name.trim(),
              },
        },
      });
      if (authError) throw new Error(authError.message);
      if (data.session) {
        navigate(
          tokenInvitacion ? `/invitacion/${tokenInvitacion}` : '/portal',
          { replace: true },
        );
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="auth-card auth-card-wide">
          <div className="auth-card-head">
            <h1>Revisa tu correo</h1>
            <p>Enviamos un enlace de confirmación a {email}.</p>
          </div>
          <div className="auth-note">
            <FontAwesomeIcon icon={faCircleCheck} />
            <p>
              {esInvitacion
                ? 'Confirma tu correo y luego inicia sesión para aceptar la invitación. No se te asignará ningún negocio automáticamente.'
                : 'Confirma tu correo y luego inicia sesión. Crearemos tu negocio automáticamente con los datos que ya capturaste; no tendrás que volver a escribir el formulario.'}
            </p>
          </div>
          <p className="auth-signup"><Link to="/login">Volver a iniciar sesión</Link></p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide auth-card-register">
        <div className="auth-card-head">
          <span className="auth-pill"><i />Portal para negocios</span>
          <h1>Crear cuenta en Benefy</h1>
          <p>Registra tu negocio y comienza a fidelizar clientes.</p>
        </div>

        {error ? (
          <div className="auth-alert auth-alert--error" role="alert">
            <FontAwesomeIcon icon={faCircleExclamation} />
            <p>{error}</p>
          </div>
        ) : null}

        <form className="auth-form auth-form-tight" onSubmit={submit}>
          {!esInvitacion ? (
            <div className="auth-field">
              <label htmlFor="business-name">Nombre comercial o de tu negocio</label>
              <div className="auth-control">
                <span className="auth-control-icon"><FontAwesomeIcon icon={faStore} /></span>
                <input id="business-name" value={business} onChange={(e) => setBusiness(e.target.value)} required placeholder="Ej: Café Blend Roma" />
              </div>
            </div>
          ) : null}
          <div className="auth-field">
            <label htmlFor="full-name">Nombre completo del responsable</label>
            <div className="auth-control">
              <span className="auth-control-icon"><FontAwesomeIcon icon={faIdBadge} /></span>
              <input id="full-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="work-email">Correo electrónico comercial</label>
            <div className="auth-control">
              <span className="auth-control-icon"><FontAwesomeIcon icon={faEnvelope} /></span>
              <input id="work-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="password-input">Contraseña</label>
            <div className="auth-control">
              <span className="auth-control-icon"><FontAwesomeIcon icon={faLock} /></span>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} aria-label="Mostrar u ocultar contraseña">
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>
          <label className="auth-terms">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>Acepto los términos, la política de privacidad y el tratamiento de datos.</span>
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        <p className="auth-signup">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </div>
    </AuthLayout>
  );
}
