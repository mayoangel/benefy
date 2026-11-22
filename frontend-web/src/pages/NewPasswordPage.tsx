import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout.tsx';
import { supabase } from '../lib/supabase.ts';

export default function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw new Error(authError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card-head">
          <h1>Nueva contraseña</h1>
          <p>Define una contraseña nueva para tu cuenta.</p>
        </div>
        {done ? (
          <div className="auth-sent" role="status">
            <h2>Contraseña actualizada</h2>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <button type="button" onClick={() => navigate('/login', { replace: true })}>
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {error ? <div className="auth-alert auth-alert--error" role="alert">{error}</div> : null}
            <div className="auth-field">
              <label htmlFor="new-password">Contraseña</label>
              <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirmar contraseña</label>
              <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </div>
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
        <p className="auth-signup"><Link to="/login">Volver a iniciar sesión</Link></p>
      </div>
    </AuthLayout>
  );
}
