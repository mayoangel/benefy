import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCircleCheck,
  faCircleExclamation,
  faEnvelope,
  faEnvelopeOpenText,
} from '@fortawesome/free-solid-svg-icons';

import AuthLayout from '../components/AuthLayout.tsx';
import { supabase } from '../lib/supabase.ts';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes('@') || !email.includes('.')) {
      setError('Ingresa un correo válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/actualizar-password` },
      );
      if (authError) throw new Error(authError.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el enlace.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-head auth-card-head-left">
          <h1>Recuperar contraseña</h1>
          <p>Ingresa tu correo y te enviaremos un enlace para restablecer tu acceso.</p>
        </div>

        {sent ? (
          <div className="auth-sent" role="status">
            <span className="auth-sent-icon"><FontAwesomeIcon icon={faEnvelopeOpenText} /></span>
            <h2>Revisa tu correo</h2>
            <p>Si el correo está registrado, recibirás un enlace de recuperación.</p>
            <button type="button" onClick={() => setSent(false)}>Enviar de nuevo</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {error ? (
              <div className="auth-alert auth-alert--error" role="alert">
                <FontAwesomeIcon icon={faCircleExclamation} /><p>{error}</p>
              </div>
            ) : null}
            <div className="auth-field">
              <label htmlFor="recovery-email">Correo electrónico</label>
              <div className="auth-control">
                <span className="auth-control-icon"><FontAwesomeIcon icon={faEnvelope} /></span>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <button className="auth-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Enviando...' : 'Enviar enlace de recuperación'}</span>
            </button>
          </form>
        )}

        <p className="auth-return">
          <Link to="/login"><FontAwesomeIcon icon={faArrowLeft} /> Volver a iniciar sesión</Link>
        </p>
        <div className="auth-note">
          <FontAwesomeIcon icon={faCircleCheck} />
          <p>El enlace se envía mediante Supabase Auth.</p>
        </div>
      </div>
    </AuthLayout>
  );
}
