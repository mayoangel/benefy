import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider.tsx';
import { api } from '../lib/api.ts';
import type { CategoriaResumen } from '../lib/types.ts';
import AuthLayout from '../components/AuthLayout.tsx';

export default function NewBusinessPage() {
  const { createBusiness, needsProfile } = useAuth();
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [categoria, setCategoria] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getCategories()
      .then((data) => {
        setCategorias(data);
        if (data[0]) setCategoria(String(data[0].id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las categorías.'));
  }, []);

  if (needsProfile) {
    return <Navigate to="/completar-perfil" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!nombre.trim() || !direccion.trim() || !correo.trim() || !categoria) {
      setError('Completa los campos obligatorios.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await createBusiness({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        correo: correo.trim(),
        telefono: telefono.trim() || undefined,
        categoria: Number(categoria),
      });
      const primera = updated?.membresias[0];
      navigate(
        primera ? `/portal/negocio/${primera.negocio.id}` : '/portal',
        { replace: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el negocio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-head">
          <span className="auth-pill"><i />Alta comercial</span>
          <h1>Registra tu negocio</h1>
          <p>Crea el negocio y tu membresía de dueño en Benefy.</p>
        </div>
        {error ? <div className="auth-alert auth-alert--error" role="alert">{error}</div> : null}
        <form className="auth-form auth-form-tight" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="new-business-name">Nombre del negocio</label>
            <input id="new-business-name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="new-business-address">Dirección</label>
            <input id="new-business-address" value={direccion} onChange={(e) => setDireccion(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="new-business-email">Correo del negocio</label>
            <input id="new-business-email" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="new-business-phone">Teléfono (opcional)</label>
            <input id="new-business-phone" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="new-business-category">Categoría</label>
            <select id="new-business-category" value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
              <option value="">Selecciona una categoría</option>
              {categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Registrando...' : 'Crear negocio'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
